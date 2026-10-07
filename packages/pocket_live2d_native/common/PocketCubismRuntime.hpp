#pragma once
#include "PocketInput.hpp"
#include <functional>
#include <memory>
#include <string>
#include <vector>
namespace pocket {
using Bytes = std::vector<unsigned char>;
using Reader = std::function<Bytes(const std::string&)>;
class Runtime {
public:
    static bool available();
    explicit Runtime(Reader reader);
    ~Runtime();
    Runtime(const Runtime&) = delete;
    Runtime& operator=(const Runtime&) = delete;
    void load(const std::string& manifest, int width, int height);
    void resize(int width, int height);
    void draw(float seconds);
    void motion(const std::string& group, int index);
    void expression(const std::string& name);
    void tap(float x, float y);
    void orientation(float x, float y, float z);
    void face(const std::array<float, 12>& data);
    void look(float x, float y, bool active);
    void reset();
private:
    class Impl;
    std::unique_ptr<Impl> impl;
};
}
