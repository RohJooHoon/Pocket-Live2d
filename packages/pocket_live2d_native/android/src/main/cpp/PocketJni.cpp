#include <jni.h>
#include <android/asset_manager_jni.h>
#include <stdexcept>
#include "PocketCubismRuntime.hpp"
using pocket::Runtime;
namespace {
Runtime* runtime(jlong handle) { return reinterpret_cast<Runtime*>(handle); }
std::string text(JNIEnv* env, jstring value) {
    const char* bytes = env->GetStringUTFChars(value, nullptr);
    std::string output(bytes);
    env->ReleaseStringUTFChars(value, bytes);
    return output;
}
template<class F> void protect(JNIEnv* env, F action) {
    try { action(); }
    catch (const std::exception& error) {
        env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), error.what());
    }
}
}
extern "C" {
JNIEXPORT jboolean JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_available(JNIEnv*, jobject) {
    return Runtime::available();
}
JNIEXPORT jlong JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_create(JNIEnv* env, jobject, jobject assets) {
    Runtime* result = nullptr;
    protect(env, [&] {
        auto* manager = AAssetManager_fromJava(env, assets);
        result = new Runtime([manager](const std::string& path) {
            auto* asset = AAssetManager_open(manager, path.c_str(), AASSET_MODE_BUFFER);
            if (!asset) throw std::runtime_error("Missing model resource: " + path);
            pocket::Bytes bytes(static_cast<size_t>(AAsset_getLength(asset)));
            const int read = AAsset_read(asset, bytes.data(), bytes.size());
            AAsset_close(asset);
            if (read < 0 || static_cast<size_t>(read) != bytes.size()) throw std::runtime_error("Incomplete asset read");
            return bytes;
        });
    });
    return reinterpret_cast<jlong>(result);
}
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_destroy(JNIEnv*, jobject, jlong h) { delete runtime(h); }
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_load(JNIEnv* env, jobject, jlong h, jstring p, jint w, jint height) {
    protect(env,[&]{runtime(h)->load(text(env,p),w,height);});
}
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_resize(JNIEnv* env,jobject,jlong h,jint w,jint height) {
    protect(env,[&]{runtime(h)->resize(w,height);});
}
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_draw(JNIEnv* env,jobject,jlong h,jfloat dt) {
    protect(env,[&]{runtime(h)->draw(dt);});
}
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_motion(JNIEnv* env,jobject,jlong h,jstring g,jint i) {
    protect(env,[&]{runtime(h)->motion(text(env,g),i);});
}
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_expression(JNIEnv* env,jobject,jlong h,jstring n) {
    protect(env,[&]{runtime(h)->expression(text(env,n));});
}
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_tap(JNIEnv* env,jobject,jlong h,jfloat x,jfloat y) {
    protect(env,[&]{runtime(h)->tap(x,y);});
}
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_orientation(JNIEnv*,jobject,jlong h,jfloat x,jfloat y,jfloat z) {runtime(h)->orientation(x,y,z);}
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_face(JNIEnv* env,jobject,jlong h,jfloatArray values) {
    if(env->GetArrayLength(values)!=12) return;
    std::array<float,12> data;
    env->GetFloatArrayRegion(values,0,12,data.data());
    runtime(h)->face(data);
}
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_look(JNIEnv*,jobject,jlong h,jfloat x,jfloat y,jboolean active) {runtime(h)->look(x,y,active);}
JNIEXPORT void JNICALL Java_com_rohjoohoon_pocket_1live2d_1native_PocketCubismJni_reset(JNIEnv*,jobject,jlong h) {runtime(h)->reset();}
}
