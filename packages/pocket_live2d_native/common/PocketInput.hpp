#pragma once
#include <algorithm>
#include <array>
#include <cmath>
namespace pocket {
inline float finiteClamp(float value, float low, float high) {
    return std::isfinite(value) ? std::max(low, std::min(high, value)) : 0.f;
}
struct Input {
    // angle XYZ, eye XY, eye open LR, mouth open/form, body X, brow LR.
    std::array<float, 12> values{{0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0}};
    int mode = 0;
    bool touch = false;
    float touchX = 0, touchY = 0;
    void orientation(float x, float y, float z) {
        mode = 1;
        x = finiteClamp(x, -1, 1); y = finiteClamp(y, -1, 1); z = finiteClamp(z, -1, 1);
        values[0] = x * 30; values[1] = y * 30; values[2] = z * 15;
        values[3] = x * .7f; values[4] = y * .7f; values[9] = x * 10;
    }
    void face(const std::array<float, 12>& data) {
        mode = 2; touch = false; values = data;
        values[0] = finiteClamp(values[0], -30, 30);
        values[1] = finiteClamp(values[1], -30, 30);
        values[2] = finiteClamp(values[2], -15, 15);
        for (int i : {3, 4, 8}) values[i] = finiteClamp(values[i], -1, 1);
        for (int i : {5, 6, 7, 10, 11}) values[i] = finiteClamp(values[i], 0, 1);
        values[9] = finiteClamp(values[0] * .25f, -10, 10);
    }
    std::array<float, 12> target() const {
        auto output = values;
        if (touch && mode != 2) {
            output[0] = finiteClamp(touchX, -1, 1) * 30;
            output[1] = finiteClamp(touchY, -1, 1) * 30;
            output[3] = finiteClamp(touchX, -1, 1);
            output[4] = finiteClamp(touchY, -1, 1);
        }
        return output;
    }
};
inline void interpolate(std::array<float, 12>& current, const Input& input, float dt) {
    const auto target = input.target();
    for (int i = 0; i < 12; ++i) {
        const float alpha = i == 9 ? .04f : i < 3 ? .10f : .18f;
        const float factor = 1 - std::pow(1 - alpha, finiteClamp(dt, 0, .1f) * 60);
        current[i] += (target[i] - current[i]) * factor;
    }
}
}
