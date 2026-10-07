Pod::Spec.new do |s|
  s.name = 'pocket_live2d_native'
  s.version = '0.1.0'
  s.summary = 'Pocket Live2D native surface and motion input adapter.'
  s.description = s.summary
  s.homepage = 'https://github.com/RohJooHoon/Pocket-Live2d'
  s.license = { :type => 'Proprietary', :text => 'See repository owner for redistribution permission.' }
  s.author = { 'Pocket Live2D' => '76926000+RohJooHoon@users.noreply.github.com' }
  s.source = { :path => '.' }
  s.source_files = 'Classes/**/*'
  s.dependency 'Flutter'
  s.platform = :ios, '13.0'
  s.frameworks = 'CoreMotion', 'UIKit'
  s.swift_version = '5.0'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
