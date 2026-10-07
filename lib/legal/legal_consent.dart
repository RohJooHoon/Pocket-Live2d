import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'legal_document.dart';

/// Change this when the terms or privacy policy change so users accept again.
const legalConsentVersion = '2026-10-07';
const legalConsentPreferenceKey = 'legal_consent_version';

/// Shows the consent screen until the current legal documents are accepted.
///
/// The Live2D Proprietary Software License (5.2.2) requires end users to
/// agree to terms that protect the bundled Cubism Core, so the app (and its
/// camera/sensor inputs) only starts after this consent.
class LegalConsentGate extends StatefulWidget {
  const LegalConsentGate({super.key, required this.child});

  final Widget child;

  @override
  State<LegalConsentGate> createState() => _LegalConsentGateState();
}

class _LegalConsentGateState extends State<LegalConsentGate> {
  bool? _accepted;

  @override
  void initState() {
    super.initState();
    unawaited(_loadConsent());
  }

  Future<void> _loadConsent() async {
    var accepted = false;
    try {
      final preferences = await SharedPreferences.getInstance();
      accepted = preferences.getString(legalConsentPreferenceKey) == legalConsentVersion;
    } catch (_) {
      // Without storage the user is simply asked again on the next launch.
    }
    if (mounted) setState(() => _accepted = accepted);
  }

  Future<void> _accept() async {
    setState(() => _accepted = true);
    try {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setString(legalConsentPreferenceKey, legalConsentVersion);
    } catch (_) {
      // Consent still applies to this session; it is requested again next launch.
    }
  }

  @override
  Widget build(BuildContext context) {
    final accepted = _accepted;
    if (accepted == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (accepted) return widget.child;
    return LegalConsentScreen(onAccept: _accept);
  }
}

class LegalConsentScreen extends StatelessWidget {
  const LegalConsentScreen({super.key, required this.onAccept});

  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: ListView(
                  children: [
                    Text('MotionMate를 시작하기 전에', style: textTheme.headlineSmall),
                    const SizedBox(height: 16),
                    Text(
                      'MotionMate는 회원가입이 없고 개인정보를 수집하지 않아요.',
                      style: textTheme.bodyLarge,
                    ),
                    const SizedBox(height: 12),
                    const _Point('따라하기를 켠 동안에만 전면 카메라를 사용해요.'),
                    const _Point('카메라 영상과 얼굴 정보는 기기 안에서만 처리하고, 저장하거나 밖으로 보내지 않아요.'),
                    const _Point('앱에 포함된 Live2D Cubism SDK 등 소프트웨어와 캐릭터 데이터를 분해하거나 추출해서 배포하면 안 돼요.'),
                    const SizedBox(height: 16),
                    for (final document in LegalDocument.values)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(document.title),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => LegalDocumentPage.open(context, document),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '‘동의하고 시작하기’를 누르면 이용약관과 개인정보처리방침에 동의하게 돼요. '
                '동의하지 않으면 앱을 이용할 수 없어요.',
                style: textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: onAccept,
                child: const Text('동의하고 시작하기'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Point extends StatelessWidget {
  const _Point(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 16, child: Text('•', style: style)),
          Expanded(child: Text(text, style: style)),
        ],
      ),
    );
  }
}
