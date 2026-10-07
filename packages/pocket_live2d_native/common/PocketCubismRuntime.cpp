#include "PocketCubismRuntime.hpp"
#include <stdexcept>
#ifndef POCKET_CUBISM_ENABLED
#define POCKET_CUBISM_ENABLED 0
#endif
#if POCKET_CUBISM_ENABLED
#include <CubismFramework.hpp>
#include <CubismModelSettingJson.hpp>
#include <ICubismAllocator.hpp>
#include <Id/CubismIdManager.hpp>
#include <Model/CubismUserModel.hpp>
#include <Motion/CubismMotion.hpp>
#include <Rendering/OpenGL/CubismRenderer_OpenGLES2.hpp>
#include <Rendering/OpenGL/CubismShader_OpenGLES2.hpp>
#include <map>
#include <cstdlib>
#include <cstring>
#include <mutex>
#define STB_IMAGE_IMPLEMENTATION
#define STBI_ONLY_PNG
#include <stb_image.h>
#include "PocketShaders.hpp"
using namespace Live2D::Cubism::Framework;
namespace {
class Allocator final : public ICubismAllocator {
public:
    void* Allocate(csmSizeType n) override { return std::malloc(n); }
    void Deallocate(void* p) override { std::free(p); }
    void* AllocateAligned(csmSizeType n, csmUint32 alignment) override {
        void* p = nullptr;
        return posix_memalign(&p, alignment, n) == 0 ? p : nullptr;
    }
    void DeallocateAligned(void* p) override { std::free(p); }
};
Allocator allocator;
CubismFramework::Option options;
std::mutex frameworkLock;
unsigned references = 0;
csmByte* readShader(const std::string path, csmSizeInt* size) {
    const auto slash = path.find_last_of('/');
    const auto name = slash == std::string::npos ? path : path.substr(slash + 1);
    const auto found = pocketShaderSources().find(name);
    if (found == pocketShaderSources().end()) { *size = 0; return nullptr; }
    *size = static_cast<csmSizeInt>(found->second.size());
    auto* bytes = new csmByte[*size];
    std::memcpy(bytes, found->second.data(), *size);
    return bytes;
}
void acquireFramework() {
    std::lock_guard<std::mutex> lock(frameworkLock);
    if (references++ == 0) {
        options.LoadFileFunction = readShader;
        options.ReleaseBytesFunction = [](csmByte* p) { delete[] p; };
        options.LoggingLevel = CubismFramework::Option::LogLevel_Error;
        if (!CubismFramework::StartUp(&allocator, &options)) {
            references = 0;
            throw std::runtime_error("Cubism Framework startup failed");
        }
        CubismFramework::Initialize();
    }
}
void releaseFramework() {
    std::lock_guard<std::mutex> lock(frameworkLock);
    if (--references == 0) {
        Rendering::CubismShader_OpenGLES2::DeleteInstance();
        CubismFramework::Dispose();
        CubismFramework::CleanUp();
    }
}
const char* ids[] = {"ParamAngleX", "ParamAngleY", "ParamAngleZ", "ParamEyeBallX",
    "ParamEyeBallY", "ParamEyeLOpen", "ParamEyeROpen", "ParamMouthOpenY",
    "ParamMouthForm", "ParamBodyAngleX", "ParamBrowLY", "ParamBrowRY"};
class Model final : public CubismUserModel {
public:
    std::unique_ptr<CubismModelSettingJson> setting;
    std::map<std::string, ACubismMotion*> motions, expressions;
    std::vector<GLuint> textures;
    pocket::Input input;
    std::array<float, 12> current{{0,0,0,0,0,1,1,0,0,0,0,0}};
    int width = 1, height = 1;
    ~Model() override {
        _motionManager->StopAllMotions();
        _expressionManager->StopAllMotions();
        for (auto& entry : motions) ACubismMotion::Delete(entry.second);
        for (auto& entry : expressions) ACubismMotion::Delete(entry.second);
        if (!textures.empty()) glDeleteTextures(static_cast<GLsizei>(textures.size()), textures.data());
    }
    void load(const pocket::Reader& read, const std::string& manifest, int w, int h) {
        width = std::max(w, 1); height = std::max(h, 1);
        const auto slash = manifest.find_last_of('/');
        const std::string directory = manifest.substr(0, slash + 1);
        auto bytes = read(manifest);
        if (bytes.empty()) throw std::runtime_error("Model manifest is empty");
        setting.reset(new CubismModelSettingJson(bytes.data(), static_cast<csmSizeInt>(bytes.size())));
        bytes = read(directory + setting->GetModelFileName());
        LoadModel(bytes.data(), static_cast<csmSizeInt>(bytes.size()), true);
        if (!_model) throw std::runtime_error("Invalid or unsupported moc3 model");
        auto loadOptional = [&](const char* name, auto loader) {
            if (!name || !*name) return;
            auto data = read(directory + name);
            (this->*loader)(data.data(), static_cast<csmSizeInt>(data.size()));
        };
        loadOptional(setting->GetPhysicsFileName(), &Model::LoadPhysics);
        loadOptional(setting->GetPoseFileName(), &Model::LoadPose);
        for (int groupIndex = 0; groupIndex < setting->GetMotionGroupCount(); ++groupIndex) {
            const auto group = setting->GetMotionGroupName(groupIndex);
            for (int index = 0; index < setting->GetMotionCount(group); ++index) {
                auto data = read(directory + setting->GetMotionFileName(group, index));
                const auto key = std::string(group) + ":" + std::to_string(index);
                auto* motion = static_cast<CubismMotion*>(LoadMotion(
                    data.data(), static_cast<csmSizeInt>(data.size()), key.c_str(),
                    nullptr, nullptr, setting.get(), group, index));
                if (!motion) throw std::runtime_error("Invalid motion " + key);
                motions[key] = motion;
            }
        }
        for (int i = 0; i < setting->GetExpressionCount(); ++i) {
            auto data = read(directory + setting->GetExpressionFileName(i));
            const std::string name = setting->GetExpressionName(i);
            auto* expression = LoadExpression(data.data(), static_cast<csmSizeInt>(data.size()), name.c_str());
            if (!expression) throw std::runtime_error("Invalid expression " + name);
            expressions[name] = expression;
        }
        csmMap<csmString, csmFloat32> layout;
        setting->GetLayoutMap(layout);
        _modelMatrix->SetupFromLayout(layout);
        _model->SaveParameters();
        CreateRenderer(width, height);
        auto* renderer = GetRenderer<Rendering::CubismRenderer_OpenGLES2>();
        renderer->IsPremultipliedAlpha(false);
        for (int i = 0; i < setting->GetTextureCount(); ++i) {
            auto data = read(directory + setting->GetTextureFileName(i));
            int textureWidth, textureHeight, components;
            unsigned char* rgba = stbi_load_from_memory(data.data(), static_cast<int>(data.size()),
                &textureWidth, &textureHeight, &components, 4);
            if (!rgba) throw std::runtime_error("Could not decode model texture");
            GLuint texture;
            glGenTextures(1, &texture);
            glBindTexture(GL_TEXTURE_2D, texture);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, textureWidth, textureHeight, 0, GL_RGBA, GL_UNSIGNED_BYTE, rgba);
            stbi_image_free(rgba);
            textures.push_back(texture);
            renderer->BindTexture(i, texture);
        }
        _eyeBlink = CubismEyeBlink::Create(setting.get());
        resize(width, height);
    }
    void resize(int w, int h) {
        width = std::max(w, 1); height = std::max(h, 1);
        SetRenderTargetSize(width, height);
        const float aspect = static_cast<float>(width) / height;
        const float modelAspect = _model->GetCanvasWidth() / _model->GetCanvasHeight();
        if (modelAspect > aspect) _modelMatrix->SetWidth(1.8f * aspect);
        else _modelMatrix->SetHeight(1.8f);
    }
    void play(const std::string& group, int index, int priority) {
        const int count = setting->GetMotionCount(group.c_str());
        if (count <= 0) throw std::runtime_error("Unknown motion group: " + group);
        if (index < 0) index = std::rand() % count;
        auto found = motions.find(group + ":" + std::to_string(index));
        if (found == motions.end()) throw std::runtime_error("Unknown motion index");
        if (priority == 3) _motionManager->SetReservePriority(priority);
        if (priority == 3 || _motionManager->ReserveMotion(priority))
            _motionManager->StartMotionPriority(found->second, false, priority);
    }
    void setExpression(ACubismMotion* expression) { _expressionManager->StartMotion(expression, false); }
    void update(float dt) {
        dt = pocket::finiteClamp(dt, 0, .1f);
        _model->LoadParameters();
        if (_motionManager->IsFinished() && setting->GetMotionCount("Idle") > 0) play("Idle", -1, 1);
        const bool animated = _motionManager->UpdateMotion(_model, dt);
        _model->SaveParameters();
        if (!animated && _eyeBlink && input.mode != 2) _eyeBlink->UpdateParameters(_model, dt);
        pocket::interpolate(current, input, dt);
        for (int i = 0; i < 12; ++i) {
            const auto id = CubismFramework::GetIdManager()->GetId(ids[i]);
            if (_model->GetParameterIndex(id) >= _model->GetParameterCount()) continue;
            if (input.mode == 2) _model->SetParameterValue(id, current[i]);
            else if (i < 5 || i == 9) _model->AddParameterValue(id, current[i]);
        }
        _expressionManager->UpdateMotion(_model, dt);
        if (_physics) _physics->Evaluate(_model, dt);
        if (_pose) _pose->UpdateParameters(_model, dt);
        _model->Update();
    }
    void draw() {
        CubismMatrix44 projection;
        projection.ScaleRelative(static_cast<float>(height) / width, 1);
        projection.MultiplyByMatrix(_modelMatrix);
        auto* renderer = GetRenderer<Rendering::CubismRenderer_OpenGLES2>();
        renderer->SetMvpMatrix(&projection);
        renderer->DrawModel();
    }
    void tap(float x, float y) {
        x = pocket::finiteClamp(x, -1, 1) * width / height;
        y = pocket::finiteClamp(y, -1, 1);
        bool hit = false;
        for (int i = 0; i < setting->GetHitAreasCount(); ++i)
            hit = hit || IsHit(setting->GetHitAreaId(i), x, y);
        if (setting->GetHitAreasCount() == 0) {
            for (int i = 0; i < _model->GetDrawableCount() && !hit; ++i)
                if (_model->GetDrawableOpacity(i) > 0) hit = IsHit(_model->GetDrawableId(i), x, y);
        }
        if (hit && setting->GetMotionCount("TapBody") > 0) play("TapBody", -1, 3);
    }
};
}
namespace pocket {
class Runtime::Impl {
public:
    Reader read;
    std::unique_ptr<Model> model;
    explicit Impl(Reader r) : read(std::move(r)) { acquireFramework(); }
    ~Impl() { model.reset(); releaseFramework(); }
};
bool Runtime::available() { return true; }
Runtime::Runtime(Reader reader) : impl(new Impl(std::move(reader))) {}
Runtime::~Runtime() = default;
void Runtime::load(const std::string& path, int w, int h) {
    auto next = std::unique_ptr<Model>(new Model());
    next->load(impl->read, path, w, h);
    impl->model = std::move(next);
}
void Runtime::resize(int w, int h) { if (impl->model) impl->model->resize(w,h); }
void Runtime::draw(float dt) { if (impl->model) { impl->model->update(dt); impl->model->draw(); } }
void Runtime::motion(const std::string& group, int index) {
    if (!impl->model) throw std::runtime_error("Model is not loaded");
    impl->model->play(group,index,3);
}
void Runtime::expression(const std::string& name) {
    if (!impl->model) throw std::runtime_error("Model is not loaded");
    auto found = impl->model->expressions.find(name);
    if (found == impl->model->expressions.end()) throw std::runtime_error("Unknown expression: " + name);
    impl->model->GetModel(); // Keep access validation with the loaded model.
    impl->model->setExpression(found->second);
}
void Runtime::tap(float x,float y) { if (impl->model) impl->model->tap(x,y); }
void Runtime::orientation(float x,float y,float z) { if (impl->model) impl->model->input.orientation(x,y,z); }
void Runtime::face(const std::array<float,12>& data) { if (impl->model) impl->model->input.face(data); }
void Runtime::look(float x,float y,bool active) {
    if (impl->model) { impl->model->input.touch = active; impl->model->input.touchX=x; impl->model->input.touchY=y; }
}
void Runtime::reset() { if (impl->model) impl->model->input=Input(); }
}
#else
namespace pocket {
class Runtime::Impl {};
bool Runtime::available() { return false; }
Runtime::Runtime(Reader) : impl(new Impl()) {}
Runtime::~Runtime() = default;
void Runtime::load(const std::string&,int,int) { throw std::runtime_error("Cubism SDK/Core is not installed"); }
void Runtime::resize(int,int) {}
void Runtime::draw(float) {}
void Runtime::motion(const std::string&,int) { throw std::runtime_error("Cubism SDK/Core is not installed"); }
void Runtime::expression(const std::string&) { throw std::runtime_error("Cubism SDK/Core is not installed"); }
void Runtime::tap(float,float) {}
void Runtime::orientation(float,float,float) {}
void Runtime::face(const std::array<float,12>&) {}
void Runtime::look(float,float,bool) {}
void Runtime::reset() {}
}
#endif
