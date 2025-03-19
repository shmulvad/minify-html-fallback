use crate::ast::NodeData;
use crate::ast::ScriptOrStyleLang;
use crate::parse::content::ParsedContent;
use crate::parse::Code;
use aho_corasick::AhoCorasick;
use aho_corasick::AhoCorasickBuilder;
use aho_corasick::AhoCorasickKind;
use once_cell::sync::Lazy;

static END: Lazy<AhoCorasick> = Lazy::new(|| {
  AhoCorasickBuilder::new()
    .ascii_case_insensitive(true)
    .kind(Some(AhoCorasickKind::DFA))
    .build(["</script"])
    .unwrap()
});

pub fn parse_script_content(code: &mut Code, lang: ScriptOrStyleLang) -> ParsedContent {
  let (len, closing_tag_omitted) = match END.find(code.as_slice()) {
    Some(m) => (m.start(), false),
    None => (code.rem(), true),
  };
  ParsedContent {
    closing_tag_omitted,
    children: vec![NodeData::ScriptOrStyleContent {
      code: code.copy_and_shift(len),
      lang,
    }],
  }
}
