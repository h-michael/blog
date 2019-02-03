---
title: "[Memo] Rustc Parser"
date: 2019-02-03T16:38:13+09:00
draft: false
toc: false
comments: false
categories:
- rust
tags:
- rust
- parser
- memo
---

git revision: [rust-lang/rust: 7754eb05c41debde225077e1708ab7ba01df62be](https://github.com/rust-lang/rust/tree/7754eb05c41debde225077e1708ab7ba01df62be)

- [src/libsyntax_pos/lib.rs](#syntax_pos)
- [src/libsyntax_pos/span_encoding.rs](#span_encoding)
- [src/libsyntax_pos/hygiene.rs](#hygiene)
- [src/libsyntax/parse/mod.rs](#parse)
- [src/libsyntax/tokenstream.rs](#tokenstream)

<!--more-->

<a id="syntax_pos"></a>
[src/libsyntax_pos/lib.rs](https://github.com/rust-lang/rust/tree/7754eb05c41debde225077e1708ab7ba01df62be/src/libsyntax_pos)
```rust
/// Differentiates between real files and common virtual files.
#[derive(Debug, Eq, PartialEq, Clone, Ord, PartialOrd, Hash, RustcDecodable, RustcEncodable)]
pub enum FileName {
    Real(PathBuf),
    /// A macro.  This includes the full name of the macro, so that there are no clashes.
    Macros(String),
    /// Call to `quote!`.
    QuoteExpansion(u64),
    /// Command line.
    Anon(u64),
    /// Hack in `src/libsyntax/parse.rs`.
    // FIXME(jseyfried)
    MacroExpansion(u64),
    ProcMacroSourceCode(u64),
    /// Strings provided as `--cfg [cfgspec]` stored in a `crate_cfg`.
    CfgSpec(u64),
    /// Strings provided as crate attributes in the CLI.
    CliCrateAttr(u64),
    /// Custom sources for explicit parser calls from plugins and drivers.
    Custom(String),
    DocTest(PathBuf, isize),
}

pub struct SourceFile {
    /// The name of the file that the source came from, source that doesn't
    /// originate from files has names between angle brackets by convention
    /// (e.g., `<anon>`).
    pub name: FileName,
    /// True if the `name` field above has been modified by `--remap-path-prefix`.
    pub name_was_remapped: bool,
    /// The unmapped path of the file that the source came from.
    /// Set to `None` if the `SourceFile` was imported from an external crate.
    pub unmapped_path: Option<FileName>,
    /// Indicates which crate this `SourceFile` was imported from.
    pub crate_of_origin: u32,
    /// The complete source code.
    pub src: Option<Lrc<String>>,
    /// The source code's hash.
    pub src_hash: u128,
    /// The external source code (used for external crates, which will have a `None`
    /// value as `self.src`.
    pub external_src: Lock<ExternalSource>,
    /// The start position of this source in the `SourceMap`.
    pub start_pos: BytePos,
    /// The end position of this source in the `SourceMap`.
    pub end_pos: BytePos,
    /// Locations of lines beginnings in the source code.
    pub lines: Vec<BytePos>,
    /// Locations of multi-byte characters in the source code.
    pub multibyte_chars: Vec<MultiByteChar>,
    /// Width of characters that are not narrow in the source code.
    pub non_narrow_chars: Vec<NonNarrowChar>,
    /// A hash of the filename, used for speeding up hashing in incremental compilation.
    pub name_hash: u128,
}

/// Spans represent a region of code, used for error reporting. Positions in spans
/// are *absolute* positions from the beginning of the source_map, not positions
/// relative to `SourceFile`s. Methods on the `SourceMap` can be used to relate spans back
/// to the original source.
/// You must be careful if the span crosses more than one file - you will not be
/// able to use many of the functions on spans in source_map and you cannot assume
/// that the length of the `span = hi - lo`; there may be space in the `BytePos`
/// range between files.
///
/// `SpanData` is public because `Span` uses a thread-local interner and can't be
/// sent to other threads, but some pieces of performance infra run in a separate thread.
/// Using `Span` is generally preferred.
#[derive(Clone, Copy, Hash, PartialEq, Eq, Ord, PartialOrd)]
pub struct SpanData {
    pub lo: BytePos,
    pub hi: BytePos,
    /// Information about where the macro came from, if this piece of
    /// code was created by a macro expansion.
    pub ctxt: SyntaxContext,
}

/// A collection of spans. Spans have two orthogonal attributes:
///
/// - They can be *primary spans*. In this case they are the locus of
///   the error, and would be rendered with `^^^`.
/// - They can have a *label*. In this case, the label is written next
///   to the mark in the snippet when we render.
#[derive(Clone, Debug, Hash, PartialEq, Eq, RustcEncodable, RustcDecodable)]
pub struct MultiSpan {
    primary_spans: Vec<Span>,
    span_labels: Vec<(Span, String)>,
}

#[derive(Clone, Debug)]
pub struct SpanLabel {
    /// The span we are going to include in the final snippet.
    pub span: Span,

    /// Is this a primary span? This is the "locus" of the message,
    /// and is indicated with a `^^^^` underline, versus `----`.
    pub is_primary: bool,

    /// What label should we attach to this span (if any)?
    pub label: Option<String>,
}

/// Identifies an offset of a multi-byte character in a `SourceFile`.
#[derive(Copy, Clone, RustcEncodable, RustcDecodable, Eq, PartialEq, Debug)]
pub struct MultiByteChar {
    /// The absolute offset of the character in the `SourceMap`.
    pub pos: BytePos,
    /// The number of bytes, `>= 2`.
    pub bytes: u8,
}

/// Identifies an offset of a non-narrow character in a `SourceFile`.
#[derive(Copy, Clone, RustcEncodable, RustcDecodable, Eq, PartialEq, Debug)]
pub enum NonNarrowChar {
    /// Represents a zero-width character.
    ZeroWidth(BytePos),
    /// Represents a wide (full-width) character.
    Wide(BytePos),
    /// Represents a tab character, represented visually with a width of 4 characters.
    Tab(BytePos),
}

/// The state of the lazy external source loading mechanism of a `SourceFile`.
#[derive(PartialEq, Eq, Clone)]
pub enum ExternalSource {
    /// The external source has been loaded already.
    Present(String),
    /// No attempt has been made to load the external source.
    AbsentOk,
    /// A failed attempt has been made to load the external source.
    AbsentErr,
    /// No external source has to be loaded, since the `SourceFile` represents a local crate.
    Unneeded,
}

/// A single source in the `SourceMap`.
#[derive(Clone)]
pub struct SourceFile {
    /// The name of the file that the source came from, source that doesn't
    /// originate from files has names between angle brackets by convention
    /// (e.g., `<anon>`).
    pub name: FileName,
    /// True if the `name` field above has been modified by `--remap-path-prefix`.
    pub name_was_remapped: bool,
    /// The unmapped path of the file that the source came from.
    /// Set to `None` if the `SourceFile` was imported from an external crate.
    pub unmapped_path: Option<FileName>,
    /// Indicates which crate this `SourceFile` was imported from.
    pub crate_of_origin: u32,
    /// The complete source code.
    pub src: Option<Lrc<String>>,
    /// The source code's hash.
    pub src_hash: u128,
    /// The external source code (used for external crates, which will have a `None`
    /// value as `self.src`.
    pub external_src: Lock<ExternalSource>,
    /// The start position of this source in the `SourceMap`.
    pub start_pos: BytePos,
    /// The end position of this source in the `SourceMap`.
    pub end_pos: BytePos,
    /// Locations of lines beginnings in the source code.
    pub lines: Vec<BytePos>,
    /// Locations of multi-byte characters in the source code.
    pub multibyte_chars: Vec<MultiByteChar>,
    /// Width of characters that are not narrow in the source code.
    pub non_narrow_chars: Vec<NonNarrowChar>,
    /// A hash of the filename, used for speeding up hashing in incremental compilation.
    pub name_hash: u128,
}

// _____________________________________________________________________________
// Pos, BytePos, CharPos
//

pub trait Pos {
    fn from_usize(n: usize) -> Self;
    fn to_usize(&self) -> usize;
    fn from_u32(n: u32) -> Self;
    fn to_u32(&self) -> u32;
}

/// A byte offset. Keep this small (currently 32-bits), as AST contains
/// a lot of them.
#[derive(Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Debug)]
pub struct BytePos(pub u32);

/// A character offset. Because of multibyte UTF-8 characters, a byte offset
/// is not equivalent to a character offset. The `SourceMap` will convert `BytePos`
/// values to `CharPos` values as necessary.
#[derive(Copy, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Debug)]
pub struct CharPos(pub usize);

// _____________________________________________________________________________
// Loc, LocWithOpt, SourceFileAndLine, SourceFileAndBytePos
//

/// A source code location used for error reporting.
#[derive(Debug, Clone)]
pub struct Loc {
    /// Information about the original source.
    pub file: Lrc<SourceFile>,
    /// The (1-based) line number.
    pub line: usize,
    /// The (0-based) column offset.
    pub col: CharPos,
    /// The (0-based) column offset when displayed.
    pub col_display: usize,
}

/// A source code location used as the result of `lookup_char_pos_adj`.
// Actually, *none* of the clients use the filename *or* file field;
// perhaps they should just be removed.
#[derive(Debug)]
pub struct LocWithOpt {
    pub filename: FileName,
    pub line: usize,
    pub col: CharPos,
    pub file: Option<Lrc<SourceFile>>,
}

// Used to be structural records.
#[derive(Debug)]
pub struct SourceFileAndLine { pub sf: Lrc<SourceFile>, pub line: usize }
#[derive(Debug)]
pub struct SourceFileAndBytePos { pub sf: Lrc<SourceFile>, pub pos: BytePos }

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct LineInfo {
    /// Index of line, starting from 0.
    pub line_index: usize,

    /// Column in line where span begins, starting from 0.
    pub start_col: CharPos,

    /// Column in line where span ends, starting from 0, exclusive.
    pub end_col: CharPos,
}

pub struct FileLines {
    pub file: Lrc<SourceFile>,
    pub lines: Vec<LineInfo>
}

thread_local!(pub static SPAN_DEBUG: Cell<fn(Span, &mut fmt::Formatter) -> fmt::Result> =
                Cell::new(default_span_debug));

#[derive(Debug)]
pub struct MacroBacktrace {
    /// span where macro was applied to generate this code
    pub call_site: Span,

    /// name of macro that was applied (e.g., "foo!" or "#[derive(Eq)]")
    pub macro_decl_name: String,

    /// span where macro was defined (if known)
    pub def_site_span: Option<Span>,
}

// _____________________________________________________________________________
// SpanLinesError, SpanSnippetError, DistinctSources, MalformedSourceMapPositions
//

pub type FileLinesResult = Result<FileLines, SpanLinesError>;

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum SpanLinesError {
    IllFormedSpan(Span),
    DistinctSources(DistinctSources),
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum SpanSnippetError {
    IllFormedSpan(Span),
    DistinctSources(DistinctSources),
    MalformedForSourcemap(MalformedSourceMapPositions),
    SourceNotAvailable { filename: FileName }
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct DistinctSources {
    pub begin: (FileName, BytePos),
    pub end: (FileName, BytePos)
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct MalformedSourceMapPositions {
    pub name: FileName,
    pub source_len: usize,
    pub begin_pos: BytePos,
    pub end_pos: BytePos
}
```

<a id="span_encoding"></a>
[src/libsyntax_pos/span_encoding.rs](https://github.com/rust-lang/rust/blob/7754eb05c41debde225077e1708ab7ba01df62be/src/libsyntax_pos/span_encoding.rs)

```rust
/// A compressed span.
/// Contains either fields of `SpanData` inline if they are small, or index into span interner.
/// The primary goal of `Span` is to be as small as possible and fit into other structures
/// (that's why it uses `packed` as well). Decoding speed is the second priority.
/// See `SpanData` for the info on span fields in decoded representation.
#[repr(packed)]
pub struct Span(u32);

// Tags
const TAG_INLINE: u32 = 0;
const TAG_INTERNED: u32 = 1;
const TAG_MASK: u32 = 1;

// Fields indexes
const BASE_INDEX: usize = 0;
const LEN_INDEX: usize = 1;
const CTXT_INDEX: usize = 2;

// Tag = 0, inline format.
// -------------------------------------------------------------
// | base 31:8  | len 7:1  | ctxt (currently 0 bits) | tag 0:0 |
// -------------------------------------------------------------
// Since there are zero bits for ctxt, only SpanData with a 0 SyntaxContext
// can be inline.
const INLINE_SIZES: [u32; 3] = [24, 7, 0];
const INLINE_OFFSETS: [u32; 3] = [8, 1, 1];

// Tag = 1, interned format.
// ------------------------
// | index 31:1 | tag 0:0 |
// ------------------------
const INTERNED_INDEX_SIZE: u32 = 31;
const INTERNED_INDEX_OFFSET: u32 = 1;

#[inline]
fn encode(sd: &SpanData) -> Span {
    let (base, len, ctxt) = (sd.lo.0, sd.hi.0 - sd.lo.0, sd.ctxt.as_u32());

    let val = if (base >> INLINE_SIZES[BASE_INDEX]) == 0 &&
                 (len >> INLINE_SIZES[LEN_INDEX]) == 0 &&
                 (ctxt >> INLINE_SIZES[CTXT_INDEX]) == 0 {
        (base << INLINE_OFFSETS[BASE_INDEX]) | (len << INLINE_OFFSETS[LEN_INDEX]) |
        (ctxt << INLINE_OFFSETS[CTXT_INDEX]) | TAG_INLINE
    } else {
        let index = with_span_interner(|interner| interner.intern(sd));
        (index << INTERNED_INDEX_OFFSET) | TAG_INTERNED
    };
    Span(val)
}

#[inline]
fn decode(span: Span) -> SpanData {
    let val = span.0;

    // Extract a field at position `pos` having size `size`.
    let extract = |pos: u32, size: u32| {
        let mask = ((!0u32) as u64 >> (32 - size)) as u32; // Can't shift u32 by 32
        (val >> pos) & mask
    };

    let (base, len, ctxt) = if val & TAG_MASK == TAG_INLINE {(
        extract(INLINE_OFFSETS[BASE_INDEX], INLINE_SIZES[BASE_INDEX]),
        extract(INLINE_OFFSETS[LEN_INDEX], INLINE_SIZES[LEN_INDEX]),
        extract(INLINE_OFFSETS[CTXT_INDEX], INLINE_SIZES[CTXT_INDEX]),
    )} else {
        let index = extract(INTERNED_INDEX_OFFSET, INTERNED_INDEX_SIZE);
        return with_span_interner(|interner| *interner.get(index));
    };
    SpanData { lo: BytePos(base), hi: BytePos(base + len), ctxt: SyntaxContext::from_u32(ctxt) }
}

#[derive(Default)]
pub struct SpanInterner {
    spans: FxHashMap<SpanData, u32>,
    span_data: Vec<SpanData>,
}
```

<a id="hygiene"></a>
[src/libsyntax_pos/hygiene.rs](https://github.com/rust-lang/rust/blob/7754eb05c41debde225077e1708ab7ba01df62be/src/libsyntax_pos/hygiene.rs)
```rust
//! Machinery for hygienic macros, inspired by the `MTWT[1]` paper.
//!
//! `[1]` Matthew Flatt, Ryan Culpepper, David Darais, and Robert Bruce Findler. 2012.
//! *Macros that work together: Compile-time bindings, partial expansion,
//! and definition contexts*. J. Funct. Program. 22, 2 (March 2012), 181-216.
//! DOI=10.1017/S0956796812000093 <https://doi.org/10.1017/S0956796812000093>

/// A SyntaxContext represents a chain of macro expansions (represented by marks).
#[derive(Clone, Copy, PartialEq, Eq, Default, PartialOrd, Ord, Hash)]
pub struct SyntaxContext(u32);

#[derive(Copy, Clone, Debug)]
struct SyntaxContextData {
    outer_mark: Mark,
    transparency: Transparency,
    prev_ctxt: SyntaxContext,
    // This context, but with all transparent and semi-transparent marks filtered away.
    opaque: SyntaxContext,
    // This context, but with all transparent marks filtered away.
    opaque_and_semitransparent: SyntaxContext,
    // Name of the crate to which `$crate` with this context would resolve.
    dollar_crate_name: Symbol,
}

/// A mark is a unique id associated with a macro expansion.
#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug, RustcEncodable, RustcDecodable)]
pub struct Mark(u32);

#[derive(Clone, Debug)]
struct MarkData {
    parent: Mark,
    default_transparency: Transparency,
    expn_info: Option<ExpnInfo>,
}

/// A property of a macro expansion that determines how identifiers
/// produced by that expansion are resolved.
#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Hash, Debug)]
pub enum Transparency {
    /// Identifier produced by a transparent expansion is always resolved at call-site.
    /// Call-site spans in procedural macros, hygiene opt-out in `macro` should use this.
    Transparent,
    /// Identifier produced by a semi-transparent expansion may be resolved
    /// either at call-site or at definition-site.
    /// If it's a local variable, label or `$crate` then it's resolved at def-site.
    /// Otherwise it's resolved at call-site.
    /// `macro_rules` macros behave like this, built-in macros currently behave like this too,
    /// but that's an implementation detail.
    SemiTransparent,
    /// Identifier produced by an opaque expansion is always resolved at definition-site.
    /// Def-site spans in procedural macros, identifiers from `macro` by default use this.
    Opaque,
}

#[derive(Debug)]
crate struct HygieneData {
    marks: Vec<MarkData>,
    syntax_contexts: Vec<SyntaxContextData>,
    markings: FxHashMap<(SyntaxContext, Mark, Transparency), SyntaxContext>,
    default_edition: Edition,
}

/// Extra information for tracking spans of macro and syntax sugar expansion
#[derive(Clone, Hash, Debug, RustcEncodable, RustcDecodable)]
pub struct ExpnInfo {
    /// The location of the actual macro invocation or syntax sugar , e.g.
    /// `let x = foo!();` or `if let Some(y) = x {}`
    ///
    /// This may recursively refer to other macro invocations, e.g., if
    /// `foo!()` invoked `bar!()` internally, and there was an
    /// expression inside `bar!`; the call_site of the expression in
    /// the expansion would point to the `bar!` invocation; that
    /// call_site span would have its own ExpnInfo, with the call_site
    /// pointing to the `foo!` invocation.
    pub call_site: Span,
    /// The span of the macro definition itself. The macro may not
    /// have a sensible definition span (e.g., something defined
    /// completely inside libsyntax) in which case this is None.
    /// This span serves only informational purpose and is not used for resolution.
    pub def_site: Option<Span>,
    /// The format with which the macro was invoked.
    pub format: ExpnFormat,
    /// Whether the macro is allowed to use #[unstable]/feature-gated
    /// features internally without forcing the whole crate to opt-in
    /// to them.
    pub allow_internal_unstable: bool,
    /// Whether the macro is allowed to use `unsafe` internally
    /// even if the user crate has `#![forbid(unsafe_code)]`.
    pub allow_internal_unsafe: bool,
    /// Enables the macro helper hack (`ident!(...)` -> `$crate::ident!(...)`)
    /// for a given macro.
    pub local_inner_macros: bool,
    /// Edition of the crate in which the macro is defined.
    pub edition: Edition,
}

/// The source of expansion.
#[derive(Clone, Hash, Debug, PartialEq, Eq, RustcEncodable, RustcDecodable)]
pub enum ExpnFormat {
    /// e.g., #[derive(...)] <item>
    MacroAttribute(Symbol),
    /// e.g., `format!()`
    MacroBang(Symbol),
    /// Desugaring done by the compiler during HIR lowering.
    CompilerDesugaring(CompilerDesugaringKind)
}

/// The kind of compiler desugaring.
#[derive(Clone, Copy, Hash, Debug, PartialEq, Eq, RustcEncodable, RustcDecodable)]
pub enum CompilerDesugaringKind {
    QuestionMark,
    TryBlock,
    /// Desugaring of an `impl Trait` in return type position
    /// to an `existential type Foo: Trait;` + replacing the
    /// `impl Trait` with `Foo`.
    ExistentialReturnType,
    Async,
    ForLoop,
}
```
<a id="parse"></a>
[src/libsyntax/parse/mod.rs](https://github.com/rust-lang/rust/blob/7754eb05c41debde225077e1708ab7ba01df62be/src/libsyntax/parse/mod.rs)

```rust
// a bunch of utility functions of the form parse_<thing>_from_<source>
// where <thing> includes crate, expr, item, stmt, tts, and one that
// uses a HOF to parse anything, and <source> includes file and
// source_str.

pub fn parse_crate_from_file<'a>(input: &Path, sess: &'a ParseSess) -> PResult<'a, ast::Crate> {
    let mut parser = new_parser_from_file(sess, input);
    parser.parse_crate_mod()
}

pub fn parse_crate_attrs_from_file<'a>(input: &Path, sess: &'a ParseSess)
                                       -> PResult<'a, Vec<ast::Attribute>> {
    let mut parser = new_parser_from_file(sess, input);
    parser.parse_inner_attributes()
}

pub fn parse_crate_from_source_str(name: FileName, source: String, sess: &ParseSess)
                                       -> PResult<ast::Crate> {
    new_parser_from_source_str(sess, name, source).parse_crate_mod()
}

pub fn parse_crate_attrs_from_source_str(name: FileName, source: String, sess: &ParseSess)
                                             -> PResult<Vec<ast::Attribute>> {
    new_parser_from_source_str(sess, name, source).parse_inner_attributes()
}

pub fn parse_stream_from_source_str(name: FileName, source: String, sess: &ParseSess,
                                    override_span: Option<Span>)
                                    -> TokenStream {
    source_file_to_stream(sess, sess.source_map().new_source_file(name, source), override_span)
}

/// Create a new parser from a source string
pub fn new_parser_from_source_str(sess: &ParseSess, name: FileName, source: String)
                                      -> Parser {
    panictry_buffer!(&sess.span_diagnostic, maybe_new_parser_from_source_str(sess, name, source))
}

/// Create a new parser from a source string. Returns any buffered errors from lexing the initial
/// token stream.
pub fn maybe_new_parser_from_source_str(sess: &ParseSess, name: FileName, source: String)
    -> Result<Parser, Vec<Diagnostic>>
{
    let mut parser = maybe_source_file_to_parser(sess,
                                                 sess.source_map().new_source_file(name, source))?;
    parser.recurse_into_file_modules = false;
    Ok(parser)
}

/// Create a new parser, handling errors as appropriate
/// if the file doesn't exist
pub fn new_parser_from_file<'a>(sess: &'a ParseSess, path: &Path) -> Parser<'a> {
    source_file_to_parser(sess, file_to_source_file(sess, path, None))
}

/// Create a new parser, returning buffered diagnostics if the file doesn't
/// exist or from lexing the initial token stream.
pub fn maybe_new_parser_from_file<'a>(sess: &'a ParseSess, path: &Path)
    -> Result<Parser<'a>, Vec<Diagnostic>> {
    let file = try_file_to_source_file(sess, path, None).map_err(|db| vec![db])?;
    maybe_source_file_to_parser(sess, file)
}

/// Given a session, a crate config, a path, and a span, add
/// the file at the given path to the source_map, and return a parser.
/// On an error, use the given span as the source of the problem.
crate fn new_sub_parser_from_file<'a>(sess: &'a ParseSess,
                                    path: &Path,
                                    directory_ownership: DirectoryOwnership,
                                    module_name: Option<String>,
                                    sp: Span) -> Parser<'a> {
    let mut p = source_file_to_parser(sess, file_to_source_file(sess, path, Some(sp)));
    p.directory.ownership = directory_ownership;
    p.root_module_name = module_name;
    p
}
```

<a id="tokenstream"></a>
[src/libsyntax/tokenstream.rs](https://github.com/rust-lang/rust/blob/7754eb05c41debde225077e1708ab7ba01df62be/src/libsyntax/tokenstream.rs)
```rust
//! # Token Streams
//!
//! `TokenStream`s represent syntactic objects before they are converted into ASTs.
//! A `TokenStream` is, roughly speaking, a sequence (eg stream) of `TokenTree`s,
//! which are themselves a single `Token` or a `Delimited` subsequence of tokens.
//!
//! ## Ownership
//! `TokenStreams` are persistent data structures constructed as ropes with reference
//! counted-children. In general, this means that calling an operation on a `TokenStream`
//! (such as `slice`) produces an entirely new `TokenStream` from the borrowed reference to
//! the original. This essentially coerces `TokenStream`s into 'views' of their subparts,
//! and a borrowed `TokenStream` is sufficient to build an owned `TokenStream` without taking
//! ownership of the original.

/// When the main rust parser encounters a syntax-extension invocation, it
/// parses the arguments to the invocation as a token-tree. This is a very
/// loose structure, such that all sorts of different AST-fragments can
/// be passed to syntax extensions using a uniform type.
///
/// If the syntax extension is an MBE macro, it will attempt to match its
/// LHS token tree against the provided token tree, and if it finds a
/// match, will transcribe the RHS token tree, splicing in any captured
/// `macro_parser::matched_nonterminals` into the `SubstNt`s it finds.
///
/// The RHS of an MBE macro is the only place `SubstNt`s are substituted.
/// Nothing special happens to misnamed or misplaced `SubstNt`s.
#[derive(Debug, Clone, PartialEq, RustcEncodable, RustcDecodable)]
pub enum TokenTree {
    /// A single token
    Token(Span, token::Token),
    /// A delimited sequence of token trees
    Delimited(DelimSpan, DelimToken, TokenStream),
}

/// # Token Streams
///
/// A `TokenStream` is an abstract sequence of tokens, organized into `TokenTree`s.
/// The goal is for procedural macros to work with `TokenStream`s and `TokenTree`s
/// instead of a representation of the abstract syntax tree.
/// Today's `TokenTree`s can still contain AST via `Token::Interpolated` for back-compat.
///
/// The use of `Option` is an optimization that avoids the need for an
/// allocation when the stream is empty. However, it is not guaranteed that an
/// empty stream is represented with `None`; it may be represented as a `Some`
/// around an empty `Vec`.
#[derive(Clone, Debug)]
pub struct TokenStream(Option<Lrc<Vec<TreeAndJoint>>>);

pub type TreeAndJoint = (TokenTree, IsJoint);

// `TokenStream` is used a lot. Make sure it doesn't unintentionally get bigger.
#[cfg(target_arch = "x86_64")]
static_assert!(MEM_SIZE_OF_TOKEN_STREAM: mem::size_of::<TokenStream>() == 8);

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum IsJoint {
    Joint,
    NonJoint
}

#[derive(Clone)]
pub struct TokenStreamBuilder(Vec<TokenStream>);


#[derive(Clone)]
pub struct Cursor {
    pub stream: TokenStream,
    index: usize,
}

#[derive(Debug, Copy, Clone, PartialEq, RustcEncodable, RustcDecodable)]
pub struct DelimSpan {
    pub open: Span,
    pub close: Span,
}
```