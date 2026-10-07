Pod::Spec.new do |s|
  s.name = 'pocket_live2d_native'
  s.version = '0.1.0'
  s.summary = 'Native Live2D renderer and tracking for Pocket Live2D.'
  s.homepage = 'https://github.com/RohJooHoon/Pocket-Live2d'
  s.license = { :type => 'Proprietary' }
  s.author = { 'Pocket Live2D' => 'RohJooHoon' }
  s.source = { :path => '.' }
  s.source_files = 'Classes/**/*.{swift,h,hpp,cpp,mm}'
  s.public_header_files = 'Classes/PocketCubismBridge.h'
  s.dependency 'Flutter'
  s.frameworks = 'CoreMotion', 'ARKit', 'GLKit', 'OpenGLES'
  s.platform = :ios, '13.0'
  s.requires_arc = true
  s.swift_version = '5.0'
  sdk_ready = File.exist?(File.join(__dir__, 'Cubism/Live2DCubismCore.xcframework'))
  if sdk_ready
    s.source_files = ['Classes/**/*.{swift,h,hpp,cpp,mm}', 'Cubism/Framework/src/**/*.{cpp,hpp,h}']
    s.exclude_files = ['Cubism/Framework/src/Rendering/Metal/**/*', 'Cubism/Framework/src/Rendering/Vulkan/**/*',
                       'Cubism/Framework/src/Rendering/D3D9/**/*', 'Cubism/Framework/src/Rendering/D3D11/**/*']
    s.vendored_frameworks = 'Cubism/Live2DCubismCore.xcframework'
  end
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'GCC_PREPROCESSOR_DEFINITIONS' => "$(inherited) CSM_TARGET_IPHONE_ES2 POCKET_CUBISM_ENABLED=#{sdk_ready ? 1 : 0}",
    'HEADER_SEARCH_PATHS' => '$(inherited) "$(PODS_TARGET_SRCROOT)/Classes/Runtime" "$(PODS_TARGET_SRCROOT)/Cubism/Framework/src" "$(PODS_TARGET_SRCROOT)/Cubism/include"'
  }
end
