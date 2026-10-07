import 'dart:convert';

import 'package:flutter/material.dart';

enum LegalDocument {
  termsOfService('이용약관', 'assets/legal/terms_of_service.md'),
  privacyPolicy('개인정보처리방침', 'assets/legal/privacy_policy.md');

  const LegalDocument(this.title, this.assetPath);

  final String title;
  final String assetPath;
}

enum LegalBlockType { heading1, heading2, bullet, subBullet, paragraph }

class LegalBlock {
  const LegalBlock(this.type, this.text);

  final LegalBlockType type;
  final String text;
}

/// Parses the small Markdown subset used by the bundled legal documents:
/// `#`/`##` headings, `-` bullets, two-space `-` sub-bullets and plain lines.
List<LegalBlock> parseLegalMarkdown(String source) {
  final blocks = <LegalBlock>[];
  for (final line in const LineSplitter().convert(source)) {
    if (line.trim().isEmpty) continue;
    if (line.startsWith('## ')) {
      blocks.add(LegalBlock(LegalBlockType.heading2, line.substring(3).trim()));
    } else if (line.startsWith('# ')) {
      blocks.add(LegalBlock(LegalBlockType.heading1, line.substring(2).trim()));
    } else if (line.startsWith('  - ')) {
      blocks.add(LegalBlock(LegalBlockType.subBullet, line.substring(4).trim()));
    } else if (line.startsWith('- ')) {
      blocks.add(LegalBlock(LegalBlockType.bullet, line.substring(2).trim()));
    } else {
      blocks.add(LegalBlock(LegalBlockType.paragraph, line.trim()));
    }
  }
  return blocks;
}

class LegalDocumentPage extends StatefulWidget {
  const LegalDocumentPage({super.key, required this.document});

  final LegalDocument document;

  static Future<void> open(BuildContext context, LegalDocument document) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => LegalDocumentPage(document: document),
      ),
    );
  }

  @override
  State<LegalDocumentPage> createState() => _LegalDocumentPageState();
}

class _LegalDocumentPageState extends State<LegalDocumentPage> {
  Future<String>? _source;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _source ??= DefaultAssetBundle.of(context).loadString(widget.document.assetPath);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(widget.document.title)),
        body: SafeArea(
          child: FutureBuilder<String>(
            future: _source,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return const Center(child: Text('문서를 불러오지 못했어요.'));
              }
              final source = snapshot.data;
              if (source == null) {
                return const Center(child: CircularProgressIndicator());
              }
              return LegalDocumentView(blocks: parseLegalMarkdown(source));
            },
          ),
        ),
      );
}

class LegalDocumentView extends StatelessWidget {
  const LegalDocumentView({super.key, required this.blocks});

  final List<LegalBlock> blocks;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      itemCount: blocks.length,
      itemBuilder: (context, index) {
        final block = blocks[index];
        switch (block.type) {
          case LegalBlockType.heading1:
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(block.text, style: textTheme.headlineSmall),
            );
          case LegalBlockType.heading2:
            return Padding(
              padding: const EdgeInsets.only(top: 20, bottom: 8),
              child: Text(block.text, style: textTheme.titleMedium),
            );
          case LegalBlockType.bullet:
            return _Bullet(marker: '•', indent: 0, text: block.text);
          case LegalBlockType.subBullet:
            return _Bullet(marker: '–', indent: 20, text: block.text);
          case LegalBlockType.paragraph:
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(block.text, style: textTheme.bodyMedium),
            );
        }
      },
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet({required this.marker, required this.indent, required this.text});

  final String marker;
  final double indent;
  final String text;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodyMedium;
    return Padding(
      padding: EdgeInsets.only(left: indent, bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 16, child: Text(marker, style: style)),
          Expanded(child: Text(text, style: style)),
        ],
      ),
    );
  }
}
