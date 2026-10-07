#include "../../packages/pocket_live2d_native/common/PocketInput.hpp"
#include <cassert>
#include <limits>
int main() {
    pocket::Input input;
    input.orientation(2, -2, std::numeric_limits<float>::quiet_NaN());
    assert(input.values[0] == 30 && input.values[1] == -30 && input.values[2] == 0);
    input.touch = true; input.touchX = -.5f; input.touchY = .5f;
    assert(input.target()[0] == -15 && input.target()[1] == 15);
    input.touch = false;
    assert(input.target()[0] == 30); // Releasing a drag restores gyro.
    std::array<float,12> face{{100,-100,50,2,-2,-1,2,2,2,100,2,-1}};
    input.face(face);
    assert(!input.touch && input.mode == 2);
    input.touch=true; input.touchX=-1;
    assert(input.target()[0] == 30); // Face tracking takes precedence.
    assert(input.values[5] == 0 && input.values[6] == 1 && input.values[7] == 1);
    assert(input.values[9] == 7.5f);
    auto at60 = pocket::Input().values;
    auto at30 = at60;
    for(int i=0;i<60;++i) pocket::interpolate(at60,input,1.f/60);
    for(int i=0;i<30;++i) pocket::interpolate(at30,input,1.f/30);
    for(int i=0;i<12;++i) assert(std::abs(at60[i]-at30[i]) < .001f);
    const auto unchanged=at60;
    pocket::interpolate(at60,input,-1);
    assert(at60 == unchanged);
    pocket::Input neutral;
    neutral.touch=true; neutral.touchX=1;
    auto current=neutral.target();
    neutral = pocket::Input();
    for(int i=0;i<300;++i) pocket::interpolate(current,neutral,1.f/60);
    assert(std::abs(current[0]) < .001f && current[5] == 1);
}
