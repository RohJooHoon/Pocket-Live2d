import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motionmate/legal/legal_consent.dart';
import 'package:motionmate/legal/legal_document.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('parseLegalMarkdown', () {
    test('maps headings, bullets, sub-bullets and plain lines', () {
      final blocks = parseLegalMarkdown(
        '# Title\n\nIntro line\n## Section\n- item\n  - detail\n',
      );

      expect(blocks.map((block) => block.type), [
        LegalBlockType.heading1,
        LegalBlockType.paragraph,
        LegalBlockType.heading2,
        LegalBlockType.bullet,
        LegalBlockType.subBullet,
      ]);
      expect(
        blocks.map((block) => block.text),
        ['Title', 'Intro line', 'Section', 'item', 'detail'],
      );
    });
  });

  group('bundled legal documents', () {
    for (final document in LegalDocument.values) {
      test('${document.name} is bundled under the MotionMate name', () async {
        final blocks = parseLegalMarkdown(
          await rootBundle.loadString(document.assetPath),
        );

        expect(blocks.first.type, LegalBlockType.heading1);
        expect(blocks.first.text, startsWith('MotionMate'));
        expect(blocks.first.text, isNot(contains('Live2D')));
      });
    }

    test('terms protect the bundled Cubism Core', () async {
      final terms = await rootBundle.loadString(
        LegalDocument.termsOfService.assetPath,
      );

      expect(terms, contains('Live2D Cubism Core'));
      expect(terms, contains('리버스 엔지니어링'));
      expect(terms, contains('추출'));
    });

    test('privacy policy keeps camera and face data on the device', () async {
      final policy = await rootBundle.loadString(
        LegalDocument.privacyPolicy.assetPath,
      );

      expect(policy, contains('저장하거나 기기 밖으로 보내지 않습니다'));
      expect(policy, contains('광고, 마케팅'));
    });
  });

  group('LegalConsentGate', () {
    Widget gate() => const MaterialApp(
          home: LegalConsentGate(child: Text('character home')),
        );

    testWidgets('asks for consent before showing the app', (tester) async {
      SharedPreferences.setMockInitialValues({});

      await tester.pumpWidget(gate());
      await tester.pumpAndSettle();

      expect(find.text('character home'), findsNothing);
      expect(find.text('동의하고 시작하기'), findsOneWidget);

      await tester.tap(find.text('동의하고 시작하기'));
      await tester.pumpAndSettle();

      expect(find.text('character home'), findsOneWidget);
      final preferences = await SharedPreferences.getInstance();
      expect(
        preferences.getString(legalConsentPreferenceKey),
        legalConsentVersion,
      );
    });

    testWidgets('skips the consent screen for the accepted version',
        (tester) async {
      SharedPreferences.setMockInitialValues({
        legalConsentPreferenceKey: legalConsentVersion,
      });

      await tester.pumpWidget(gate());
      await tester.pumpAndSettle();

      expect(find.text('character home'), findsOneWidget);
    });

    testWidgets('asks again after the documents change', (tester) async {
      SharedPreferences.setMockInitialValues({
        legalConsentPreferenceKey: '2000-01-01',
      });

      await tester.pumpWidget(gate());
      await tester.pumpAndSettle();

      expect(find.text('character home'), findsNothing);
      expect(find.text('동의하고 시작하기'), findsOneWidget);
    });

    testWidgets('opens the bundled terms from the consent screen',
        (tester) async {
      SharedPreferences.setMockInitialValues({});

      await tester.pumpWidget(gate());
      await tester.pumpAndSettle();
      await tester.tap(find.text(LegalDocument.termsOfService.title));
      await tester.pumpAndSettle();

      expect(find.text('MotionMate 이용약관'), findsOneWidget);
    });
  });
}
