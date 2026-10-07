Pod::Spec.new do |s|
  s.name             = 'pocket_live2d_native'
  s.version          = '0.1.0'
  s.summary          = 'Native iOS bridge for Pocket Live2D.'
  s.description      = 'PlatformView and Flutter channel bridge used by Pocket Live2D.'
  s.homepage         = 'https://github.com/RohJooHoon/Pocket-Live2d'
  s.license          = { :type => 'Proprietary' }
  s.author           = { 'Pocket Live2D' => 'RohJooHoon' }
  s.source           = { :path => '.' }
  s.source_files     = 'Classes/**/*'
  s.dependency 'Flutter'
  s.platform = :ios, '13.0'
  s.swift_version = '5.0'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
