// Live2D model wrapper built on the Cubism SDK for Web 5-r.5 Framework.
// Only compiled when the SDK is staged under vendor/cubism/ (see tsconfig.sdk.json).
import { CubismDefaultParameterId } from '@framework/cubismdefaultparameterid';
import { CubismModelSettingJson } from '@framework/cubismmodelsettingjson';
import { BreathParameterData, CubismBreath } from '@framework/effect/cubismbreath';
import { CubismEyeBlink } from '@framework/effect/cubismeyeblink';
import { CubismLook, LookParameterData } from '@framework/effect/cubismlook';
import type { ICubismModelSetting } from '@framework/icubismmodelsetting';
import type { CubismIdHandle } from '@framework/id/cubismid';
import { CubismFramework } from '@framework/live2dcubismframework';
import type { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { CubismMoc } from '@framework/model/cubismmoc';
import { CubismUserModel } from '@framework/model/cubismusermodel';
import type { ACubismMotion } from '@framework/motion/acubismmotion';
import { CubismBreathUpdater } from '@framework/motion/cubismbreathupdater';
import { CubismExpressionUpdater } from '@framework/motion/cubismexpressionupdater';
import { CubismEyeBlinkUpdater } from '@framework/motion/cubismeyeblinkupdater';
import { CubismLookUpdater } from '@framework/motion/cubismlookupdater';
import { CubismPhysicsUpdater } from '@framework/motion/cubismphysicsupdater';
import { CubismPoseUpdater } from '@framework/motion/cubismposeupdater';
import { CubismUpdateScheduler } from '@framework/motion/cubismupdatescheduler';

import type { FaceParameters, ParameterOffsets } from '../../types';

const PRIORITY_NONE = 0;
const PRIORITY_IDLE = 1;
const PRIORITY_FORCE = 3;

export interface CharacterModelOptions {
  modelDirectory: string;
  modelFile: string;
  shaderDirectory: string;
  idleMotion: string;
  tapMotion: string;
}

type GL = WebGLRenderingContext | WebGL2RenderingContext;

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`);
  return response.arrayBuffer();
}

export class CharacterModel extends CubismUserModel {
  private setting: ICubismModelSetting | null = null;
  private readonly scheduler = new CubismUpdateScheduler();
  private readonly loadedMotions = new Map<string, ACubismMotion>();
  private readonly loadedExpressions = new Map<string, ACubismMotion>();
  private expressionIndex = -1;
  private look: CubismLook | null = null;
  private eyeBlinkIds: CubismIdHandle[] = [];
  private lipSyncIds: CubismIdHandle[] = [];
  private motionUpdated = false;
  private ready = false;
  private looking = false;
  private tiltOffsets: ParameterOffsets | null = null;
  private faceParameters: FaceParameters | null = null;
  private readonly textures: WebGLTexture[] = [];
  private readonly ids = {
    angleX: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleX),
    angleY: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleY),
    angleZ: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamAngleZ),
    eyeBallX: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamEyeBallX),
    eyeBallY: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamEyeBallY),
    bodyAngleX: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamBodyAngleX),
    breath: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamBreath),
    eyeLOpen: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamEyeLOpen),
    eyeROpen: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamEyeROpen),
    mouthOpen: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamMouthOpenY),
    mouthForm: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamMouthForm),
    browLY: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamBrowLY),
    browRY: CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamBrowRY),
  };

  constructor(
    private readonly gl: GL,
    private readonly options: CharacterModelOptions,
  ) {
    super();
    // Models come from the network, so validate them before Core reads them.
    this._mocConsistency = true;
    this._motionConsistency = true;
  }

  get isReady(): boolean {
    return this.ready;
  }

  async load(width: number, height: number): Promise<void> {
    const { modelDirectory: dir } = this.options;
    const settingBuffer = await fetchBuffer(dir + this.options.modelFile);
    const setting = new CubismModelSettingJson(settingBuffer, settingBuffer.byteLength);
    this.setting = setting;

    const mocFile = setting.getModelFileName();
    if (!mocFile) throw new Error('model3.json does not reference a moc3 file');
    const mocBuffer = await fetchBuffer(dir + mocFile);
    if (!CubismMoc.hasMocConsistency(mocBuffer)) throw new Error('moc3 failed the consistency check');
    this.loadModel(mocBuffer, this._mocConsistency);
    if (!this.getModel()) throw new Error('Cubism Core could not load the moc3 file');

    await this.loadExpressions(setting);
    await this.loadPhysicsAndPose(setting);
    this.setupEffects(setting);

    const userDataFile = setting.getUserDataFile();
    if (userDataFile) {
      const buffer = await fetchBuffer(dir + userDataFile);
      this.loadUserData(buffer, buffer.byteLength);
    }

    this.scheduler.sortUpdatableList();

    const layout = new Map<string, number>();
    setting.getLayoutMap(layout);
    this._modelMatrix.setupFromLayout(layout);

    this.getModel().saveParameters();
    await this.loadMotions(setting);
    this._motionManager.stopAllMotions();

    this.createRenderer(width, height);
    this.getRenderer().startUp(this.gl);
    this.getRenderer().loadShaders(this.options.shaderDirectory);
    await this.loadTextures(setting);

    this.setInitialized(true);
    this.ready = true;
  }

  update(deltaSeconds: number): void {
    if (!this.ready) return;
    const model = this.getModel();

    model.loadParameters();
    this.motionUpdated = false;
    if (this._motionManager.isFinished()) {
      this.startRandomMotion(this.options.idleMotion, PRIORITY_IDLE);
    } else {
      this.motionUpdated = this._motionManager.updateMotion(model, deltaSeconds);
    }
    model.saveParameters();

    // Tilt is added after saving so it never accumulates, and before the
    // scheduler so physics reacts to it. Touch gaze takes priority over tilt.
    const offsets = this.tiltOffsets;
    if (offsets && !this.looking && !this.faceParameters) {
      model.addParameterValueById(this.ids.angleX, offsets.angleX);
      model.addParameterValueById(this.ids.angleY, offsets.angleY);
      model.addParameterValueById(this.ids.angleZ, offsets.angleZ);
      model.addParameterValueById(this.ids.eyeBallX, offsets.eyeBallX);
      model.addParameterValueById(this.ids.eyeBallY, offsets.eyeBallY);
      model.addParameterValueById(this.ids.bodyAngleX, offsets.bodyAngleX);
    }

    if (this.faceParameters && !this.looking) this.applyFacePose(this.faceParameters);

    this.scheduler.onLateUpdate(model, deltaSeconds);
    // Camera expressions take priority over automatic blinking and expressions.
    // Values are applied after saveParameters, so they never persist after stop.
    const face = this.faceParameters;
    if (face) {
      if (!this.looking) this.applyFacePose(face);
      model.setParameterValueById(this.ids.eyeLOpen, face.eyeLOpen);
      model.setParameterValueById(this.ids.eyeROpen, face.eyeROpen);
      model.setParameterValueById(this.ids.mouthOpen, face.mouthOpen);
      model.setParameterValueById(this.ids.mouthForm, face.mouthForm);
      model.setParameterValueById(this.ids.browLY, face.browLY);
      model.setParameterValueById(this.ids.browRY, face.browRY);
    }
    model.update();
  }

  private applyFacePose(face: FaceParameters): void {
    const model = this.getModel();
    model.setParameterValueById(this.ids.angleX, face.angleX);
    model.setParameterValueById(this.ids.angleY, face.angleY);
    model.setParameterValueById(this.ids.angleZ, face.angleZ);
    model.setParameterValueById(this.ids.eyeBallX, face.eyeBallX);
    model.setParameterValueById(this.ids.eyeBallY, face.eyeBallY);
    model.setParameterValueById(this.ids.bodyAngleX, face.bodyAngleX);
  }

  draw(
    projection: CubismMatrix44,
    frameBuffer: WebGLFramebuffer | null,
    viewport: number[],
  ): void {
    if (!this.ready) return;
    projection.multiplyByMatrix(this._modelMatrix);
    this.getRenderer().setMvpMatrix(projection);
    this.getRenderer().setRenderState(frameBuffer, viewport);
    this.getRenderer().drawModel(this.options.shaderDirectory);
  }

  setTiltOffsets(offsets: ParameterOffsets | null): void {
    this.tiltOffsets = offsets;
  }

  setFaceParameters(parameters: FaceParameters | null): void {
    this.faceParameters = parameters;
  }

  /** Gaze target in model space; values are clamped to the -1…1 look range. */
  lookAt(x: number, y: number): void {
    this.looking = true;
    this.setDragging(clampUnit(x), clampUnit(y));
  }

  releaseLook(): void {
    this.looking = false;
    this.setDragging(0, 0);
  }

  /** Hit-tests a point in model space; uses HitAreas when the model defines them. */
  hitTest(x: number, y: number): boolean {
    if (!this.ready || !this.setting) return false;
    const hitAreaCount = this.setting.getHitAreasCount();
    if (hitAreaCount > 0) {
      for (let i = 0; i < hitAreaCount; i += 1) {
        if (this.isHit(this.setting.getHitAreaId(i), x, y)) return true;
      }
      return false;
    }

    // Models without HitAreas (such as Mark) fall back to visible drawable bounds.
    const model = this.getModel();
    for (let i = 0; i < model.getDrawableCount(); i += 1) {
      if (
        model.getDrawableDynamicFlagIsVisible(i) &&
        model.getDrawableOpacity(i) > 0 &&
        this.isHit(model.getDrawableId(i), x, y)
      ) {
        return true;
      }
    }
    return false;
  }

  playTapMotion(): void {
    this.startRandomMotion(this.options.tapMotion, PRIORITY_FORCE);
  }

  playMotion(group: string): void {
    this.startRandomMotion(group, PRIORITY_FORCE);
  }

  cycleExpression(): string | null {
    const names = [...this.loadedExpressions.keys()];
    if (!this.ready || names.length === 0) return null;
    this.expressionIndex += 1;
    if (this.expressionIndex >= names.length) {
      this.expressionIndex = -1;
      this._expressionManager.stopAllMotions();
      return null;
    }
    const name = names[this.expressionIndex];
    this._expressionManager.startMotion(this.loadedExpressions.get(name), false);
    return name;
  }

  release(): void {
    this.ready = false;
    for (const texture of this.textures) this.gl.deleteTexture(texture);
    this.textures.length = 0;
    if (this.look) {
      CubismLook.delete(this.look);
      this.look = null;
    }
    this.scheduler.release();
    super.release();
  }

  private startRandomMotion(group: string, priority: number): void {
    const count = this.setting?.getMotionCount(group) ?? 0;
    if (count === 0) return;
    const motion = this.loadedMotions.get(`${group}_${Math.floor(Math.random() * count)}`);
    if (priority === PRIORITY_FORCE) {
      this._motionManager.setReservePriority(priority);
    } else if (!this._motionManager.reserveMotion(priority)) {
      return;
    }
    if (!motion) {
      this._motionManager.setReservePriority(PRIORITY_NONE);
      return;
    }
    this._motionManager.startMotionPriority(motion, false, priority);
  }

  private async loadExpressions(setting: ICubismModelSetting): Promise<void> {
    const count = setting.getExpressionCount();
    if (count === 0) return;
    const buffers = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        fetchBuffer(this.options.modelDirectory + setting.getExpressionFileName(i)),
      ),
    );
    buffers.forEach((buffer, i) => {
      const name = setting.getExpressionName(i);
      const expression = this.loadExpression(buffer, buffer.byteLength, name);
      if (expression) this.loadedExpressions.set(name, expression);
    });
    if (this._expressionManager) {
      this.scheduler.addUpdatableList(new CubismExpressionUpdater(this._expressionManager));
    }
  }

  private async loadPhysicsAndPose(setting: ICubismModelSetting): Promise<void> {
    const physicsFile = setting.getPhysicsFileName();
    if (physicsFile) {
      const buffer = await fetchBuffer(this.options.modelDirectory + physicsFile);
      this.loadPhysics(buffer, buffer.byteLength);
      if (this._physics) this.scheduler.addUpdatableList(new CubismPhysicsUpdater(this._physics));
    }

    const poseFile = setting.getPoseFileName();
    if (poseFile) {
      const buffer = await fetchBuffer(this.options.modelDirectory + poseFile);
      this.loadPose(buffer, buffer.byteLength);
      if (this._pose) this.scheduler.addUpdatableList(new CubismPoseUpdater(this._pose));
    }
  }

  private setupEffects(setting: ICubismModelSetting): void {
    if (setting.getEyeBlinkParameterCount() > 0) {
      this._eyeBlink = CubismEyeBlink.create(setting);
      this.scheduler.addUpdatableList(
        new CubismEyeBlinkUpdater(() => this.motionUpdated, this._eyeBlink),
      );
    }

    this._breath = CubismBreath.create();
    this._breath.setParameters([
      new BreathParameterData(this.ids.angleX, 0.0, 15.0, 6.5345, 0.5),
      new BreathParameterData(this.ids.angleY, 0.0, 8.0, 3.5345, 0.5),
      new BreathParameterData(this.ids.angleZ, 0.0, 10.0, 5.5345, 0.5),
      new BreathParameterData(this.ids.bodyAngleX, 0.0, 4.0, 15.5345, 0.5),
      new BreathParameterData(this.ids.breath, 0.5, 0.5, 3.2345, 1),
    ]);
    this.scheduler.addUpdatableList(new CubismBreathUpdater(this._breath));

    this.eyeBlinkIds = Array.from({ length: setting.getEyeBlinkParameterCount() }, (_, i) =>
      setting.getEyeBlinkParameterId(i),
    );
    this.lipSyncIds = Array.from({ length: setting.getLipSyncParameterCount() }, (_, i) =>
      setting.getLipSyncParameterId(i),
    );

    this.look = CubismLook.create();
    this.look.setParameters([
      new LookParameterData(this.ids.angleX, 30.0, 0.0, 0.0),
      new LookParameterData(this.ids.angleY, 0.0, 30.0, 0.0),
      new LookParameterData(this.ids.angleZ, 0.0, 0.0, -30.0),
      new LookParameterData(this.ids.bodyAngleX, 10.0, 0.0, 0.0),
      new LookParameterData(this.ids.eyeBallX, 1.0, 0.0, 0.0),
      new LookParameterData(this.ids.eyeBallY, 0.0, 1.0, 0.0),
    ]);
    this.scheduler.addUpdatableList(new CubismLookUpdater(this.look, this._dragManager));
  }

  private async loadMotions(setting: ICubismModelSetting): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (let g = 0; g < setting.getMotionGroupCount(); g += 1) {
      const group = setting.getMotionGroupName(g);
      for (let i = 0; i < setting.getMotionCount(group); i += 1) {
        jobs.push(
          fetchBuffer(this.options.modelDirectory + setting.getMotionFileName(group, i)).then(
            (buffer) => {
              const motion = this.loadMotion(
                buffer,
                buffer.byteLength,
                `${group}_${i}`,
                null,
                null,
                setting,
                group,
                i,
                this._motionConsistency,
              );
              if (!motion) return;
              motion.setEffectIds(this.eyeBlinkIds, this.lipSyncIds);
              this.loadedMotions.set(`${group}_${i}`, motion);
            },
          ),
        );
      }
    }
    await Promise.all(jobs);
  }

  private async loadTextures(setting: ICubismModelSetting): Promise<void> {
    const renderer = this.getRenderer();
    renderer.setIsPremultipliedAlpha(true);
    await Promise.all(
      Array.from({ length: setting.getTextureCount() }, async (_, i) => {
        const file = setting.getTextureFileName(i);
        if (!file) return;
        const texture = await this.loadTexture(this.options.modelDirectory + file);
        this.textures.push(texture);
        renderer.bindTexture(i, texture);
      }),
    );
  }

  private loadTexture(url: string): Promise<WebGLTexture> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        const gl = this.gl;
        const texture = gl.createTexture();
        if (!texture) {
          reject(new Error('WebGL could not create a texture'));
          return;
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        resolve(texture);
      };
      image.onerror = () => reject(new Error(`Failed to load texture ${url}`));
      image.src = url;
    });
  }
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(-1, value));
}
