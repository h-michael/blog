---
title: "[Memo] librustc_save_analysis"
pubDatetime: 2019-02-10T20:18:12+09:00
description: "rustcの-Zsave-analysis, -Zunprettyオプションについて調べたメモ"
tags:
  - rust
  - hir
draft: false
---


- [rls-data/src/lib.rs](#rls-data)
- [rustc -Zsave-analysis](#save-analysis)
- [rustc -Zunpretty=hir](#unpretty-hir)
- [rustc -Zunpretty="hir,identified"](#unpretty-hir-identified)
- [rustc -Zunpretty="hir,typed"](#unpretty-hir-typed)
- [rustc -Zunpretty=hir-tree](#unpretty-hir-tree)

<a id="rls-data"></a>

RustのLanguage ServerのRlsは内部で`librustc_save_analysis`の出力データを利用している。
これはrustcの`-Zsave-analysis`を実行すると出力できる。
このデータの構造は`rls-data`に定義されている。

[rls-data/src/lib.rs](https://github.com/rust-dev-tools/rls-data/blob/31a07110f5a1d00d5f0591cfcd46b64acd56e12a/src/lib.rs)
```rust

pub struct Analysis {
    /// The Config used to generate this analysis data.
    pub config: Config,
    pub version: Option<String>,
    pub compilation: Option<CompilationOptions>,
    pub prelude: Option<CratePreludeData>,
    pub imports: Vec<Import>,
    pub defs: Vec<Def>,
    pub impls: Vec<Impl>,
    pub refs: Vec<Ref>,
    pub macro_refs: Vec<MacroRef>,
    pub relations: Vec<Relation>,
    #[cfg(feature = "borrows")]
    pub per_fn_borrows: Vec<BorrowData>,
}

// DefId::index is a newtype and so the JSON serialisation is ugly. Therefore
// we use our own Id which is the same, but without the newtype.
pub struct Id {
    pub krate: u32,
    pub index: u32,
}

/// Crate name, along with its disambiguator (128-bit hash) represents a globally
/// unique crate identifier, which should allow for differentiation between
/// different crate targets or versions and should point to the same crate when
/// pulled by different other, dependent crates.
pub struct GlobalCrateId {
    pub name: String,
    pub disambiguator: (u64, u64),
}

pub struct SpanData {
    pub file_name: PathBuf,
    pub byte_start: u32,
    pub byte_end: u32,
    pub line_start: span::Row<span::OneIndexed>,
    pub line_end: span::Row<span::OneIndexed>,
    // Character offset.
    pub column_start: span::Column<span::OneIndexed>,
    pub column_end: span::Column<span::OneIndexed>,
}

pub struct CompilationOptions {
    pub directory: PathBuf,
    pub program: String,
    pub arguments: Vec<String>,
    pub output: PathBuf,
}

pub struct CratePreludeData {
    pub crate_id: GlobalCrateId,
    pub crate_root: String,
    pub external_crates: Vec<ExternalCrateData>,
    pub span: SpanData,
}

/// Data for external crates in the prelude of a crate.
pub struct ExternalCrateData {
    /// Source file where the external crate is declared.
    pub file_name: String,
    /// A crate-local crate index of an external crate. Local crate index is
    /// always 0, so these should start from 1 and range should be contiguous,
    /// e.g. from 1 to n for n external crates.
    pub num: u32,
    pub id: GlobalCrateId,
}

pub struct Import {
    pub kind: ImportKind,
    pub ref_id: Option<Id>,
    pub span: SpanData,
    pub alias_span: Option<SpanData>,
    pub name: String,
    pub value: String,
    pub parent: Option<Id>,
}

pub enum ImportKind {
    ExternCrate,
    Use,
    GlobUse,
}

pub struct Def {
    pub kind: DefKind,
    pub id: Id,
    pub span: SpanData,
    pub name: String,
    pub qualname: String,
    pub value: String,
    pub parent: Option<Id>,
    pub children: Vec<Id>,
    pub decl_id: Option<Id>,
    pub docs: String,
    pub sig: Option<Signature>,
    pub attributes: Vec<Attribute>,
}

pub enum DefKind {
    // value = variant names
    Enum,
    // value = enum name + variant name + types
    TupleVariant,
    // value = enum name + name + fields
    StructVariant,
    // value = variant name + types
    Tuple,
    // value = name + fields
    Struct,
    Union,
    // value = signature
    Trait,
    // value = type + generics
    Function,
    ForeignFunction,
    // value = type + generics
    Method,
    // No id, no value.
    Macro,
    // value = file_name
    Mod,
    // value = aliased type
    Type,
    // value = type and init expression (for all variable kinds).
    Local,
    Static,
    ForeignStatic,
    Const,
    Field,
    // no value
    ExternType,
}

pub struct Impl {
    pub id: u32,
    pub kind: ImplKind,
    pub span: SpanData,
    pub value: String,
    pub parent: Option<Id>,
    pub children: Vec<Id>,
    pub docs: String,
    pub sig: Option<Signature>,
    pub attributes: Vec<Attribute>,
}

pub enum ImplKind {
    // impl Foo { ... }
    Inherent,
    // impl Bar for Foo { ... }
    Direct,
    // impl Bar for &Foo { ... }
    Indirect,
    // impl<T: Baz> Bar for T { ... }
    //   where Foo: Baz
    Blanket,
    // impl Bar for Baz { ... } or impl Baz { ... }, etc.
    //   where Foo: Deref<Target = Baz>
    // Args are name and id of Baz
    Deref(String, Id),
}

pub struct Attribute {
    pub value: String,
    pub span: SpanData,
}

pub struct Ref {
    pub kind: RefKind,
    pub span: SpanData,
    pub ref_id: Id,
}

pub enum RefKind {
    Function,
    Mod,
    Type,
    Variable,
}

pub struct MacroRef {
    pub span: SpanData,
    pub qualname: String,
    pub callee_span: SpanData,
}

pub struct Relation {
    pub span: SpanData,
    pub kind: RelationKind,
    pub from: Id,
    pub to: Id,
}

pub enum RelationKind {
    Impl {
        id: u32,
    },
    SuperTrait,
}

pub struct Signature {
    pub text: String,
    pub defs: Vec<SigElement>,
    pub refs: Vec<SigElement>,
}

pub struct SigElement {
    pub id: Id,
    pub start: usize,
    pub end: usize,
}

// Each `BorrowData` represents all of the scopes, loans and moves
// within an fn or closure referred to by `ref_id`.
pub struct BorrowData {
    pub ref_id: Id,
    pub scopes: Vec<Scope>,
    pub loans: Vec<Loan>,
    pub moves: Vec<Move>,
    pub span: Option<SpanData>,
}

pub enum BorrowKind {
    ImmBorrow,
    MutBorrow,
}

// Each `Loan` is either temporary or assigned to a variable.
// The `ref_id` refers to the value that is being loaned/borrowed.
// Not all loans will be valid. Invalid loans can be used to help explain
// improper usage.
pub struct Loan {
    pub ref_id: Id,
    pub kind: BorrowKind,
    pub span: SpanData,
}

// Each `Move` represents an attempt to move the value referred to by `ref_id`.
// Not all `Move`s will be valid but can be used to help explain improper usage.
pub struct Move {
    pub ref_id: Id,
    pub span: SpanData,
}

// Each `Scope` refers to "scope" of a variable (we don't track all values here).
// Its ref_id refers to the variable, and the span refers to the scope/region where
// the variable is "live".
pub struct Scope {
    pub ref_id: Id,
    pub span: SpanData,
}

```

<a id="save-analysis"></a>
## rustc -Zsave-analysis

以下のファイルを`rustc -Zsave-analysis main.rs`で`save-analysis`データをdumpしてみる。


```rust
fn main() {
    Person::new("not_bind", 18);
    let kiske = Person::new("kiske", 18);
}

struct Person {
    pub name: String,
    pub age: u32,
}

impl Person {
    fn new(name: &str, age: u32) -> Person {
        Person {
            name: name.to_string(),
            age
        }
    }
}
```

`save_analysis/main.json`


```json
{
  "config": {
    "output_file": null,
    "full_docs": false,
    "pub_only": false,
    "reachable_only": false,
    "distro_crate": false,
    "signatures": false,
    "borrow_data": false
  },
  "version": "0.18.1",
  "compilation": {
    "directory": [
      47,
      104,
      111,
      109,
      101,
      47,
      104,
      45,
      109,
      105,
      99,
      104,
      97,
      101,
      108,
      47,
      103,
      104,
      113,
      47,
      103,
      105,
      116,
      104,
      117,
      98,
      46,
      99,
      111,
      109,
      47,
      104,
      45,
      109,
      105,
      99,
      104,
      97,
      101,
      108,
      47,
      115,
      97,
      118,
      101,
      95,
      97,
      110,
      97,
      108,
      121,
      115,
      105,
      115,
      95,
      101,
      120,
      97,
      109,
      112,
      108,
      101,
      47,
      115,
      114,
      99
    ],
    "program": "/home/h-michael/.rustup/toolchains/nightly-x86_64-unknown-linux-gnu/bin/rustc",
    "arguments": [
      "-Zsave-analysis",
      "main.rs",
      "--color",
      "always"
    ],
    "output": [
      109,
      97,
      105,
      110
    ]
  },
  "prelude": {
    "crate_id": {
      "name": "main",
      "disambiguator": [
        3566085715814566000,
        9444397947401218000
      ]
    },
    "crate_root": "",
    "external_crates": [
      {
        "file_name": "/home/h-michael/ghq/github.com/h-michael/save_analysis_example/src/main.rs",
        "num": 1,
        "id": {
          "name": "std",
          "disambiguator": [
            8265009444527308000,
            7194518985765690000
          ]
        }
      },
      {
        "file_name": "/home/h-michael/ghq/github.com/h-michael/save_analysis_example/src/main.rs",
        "num": 2,
        "id": {
          "name": "core",
          "disambiguator": [
            7202744723982498000,
            5331430424743903000
          ]
        }
      },
      {
        "file_name": "/home/h-michael/ghq/github.com/h-michael/save_analysis_example/src/main.rs",
        "num": 3,
        "id": {
          "name": "compiler_builtins",
          "disambiguator": [
            4150532331663477000,
            4512634110994864600
          ]
        }
      },
      {
        "file_name": "/home/h-michael/ghq/github.com/h-michael/save_analysis_example/src/main.rs",
        "num": 4,
        "id": {
          "name": "rustc_std_workspace_core",
          "disambiguator": [
            13401168369575990000,
            6985371786967755000
          ]
        }
      },
      {
        "file_name": "/home/h-michael/ghq/github.com/h-michael/save_analysis_example/src/main.rs",
        "num": 5,
        "id": {
          "name": "alloc",
          "disambiguator": [
            7598631961856314000,
            12568505469791156000
          ]
        }
      },
      {
        "file_name": "/home/h-michael/ghq/github.com/h-michael/save_analysis_example/src/main.rs",
        "num": 6,
        "id": {
          "name": "libc",
          "disambiguator": [
            12341064801760940000,
            3506842193098077000
          ]
        }
      },
      {
        "file_name": "/home/h-michael/ghq/github.com/h-michael/save_analysis_example/src/main.rs",
        "num": 7,
        "id": {
          "name": "rustc_demangle",
          "disambiguator": [
            4887010864366019000,
            1479986073120990200
          ]
        }
      },
      {
        "file_name": "/home/h-michael/ghq/github.com/h-michael/save_analysis_example/src/main.rs",
        "num": 8,
        "id": {
          "name": "unwind",
          "disambiguator": [
            7875147080199014000,
            11981640448293745000
          ]
        }
      },
      {
        "file_name": "/home/h-michael/ghq/github.com/h-michael/save_analysis_example/src/main.rs",
        "num": 9,
        "id": {
          "name": "backtrace_sys",
          "disambiguator": [
            17450918474149247000,
            15692926402825239000
          ]
        }
      },
      {
        "file_name": "/home/h-michael/ghq/github.com/h-michael/save_analysis_example/src/main.rs",
        "num": 10,
        "id": {
          "name": "panic_unwind",
          "disambiguator": [
            13005742881184737000,
            11812580933371568000
          ]
        }
      }
    ],
    "span": {
      "file_name": [
        109,
        97,
        105,
        110,
        46,
        114,
        115
      ],
      "byte_start": 0,
      "byte_end": 294,
      "line_start": 1,
      "line_end": 18,
      "column_start": 1,
      "column_end": 2
    }
  },
  "imports": [],
  "defs": [
    {
      "kind": "Mod",
      "id": {
        "krate": 0,
        "index": 0
      },
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 0,
        "byte_end": 294,
        "line_start": 1,
        "line_end": 18,
        "column_start": 1,
        "column_end": 2
      },
      "name": "",
      "qualname": "::",
      "value": "main.rs",
      "parent": null,
      "children": [
        {
          "krate": 0,
          "index": 2
        },
        {
          "krate": 0,
          "index": 4
        },
        {
          "krate": 0,
          "index": 6
        },
        {
          "krate": 0,
          "index": 8
        },
        {
          "krate": 0,
          "index": 10
        }
      ],
      "decl_id": null,
      "docs": "",
      "sig": null,
      "attributes": []
    },
    {
      "kind": "Function",
      "id": {
        "krate": 0,
        "index": 6
      },
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 3,
        "byte_end": 7,
        "line_start": 1,
        "line_end": 1,
        "column_start": 4,
        "column_end": 8
      },
      "name": "main",
      "qualname": "::main",
      "value": "fn () -> ()",
      "parent": null,
      "children": [],
      "decl_id": null,
      "docs": "",
      "sig": null,
      "attributes": []
    },
    {
      "kind": "Local",
      "id": {
        "krate": 0,
        "index": 4294967275
      },
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 53,
        "byte_end": 58,
        "line_start": 3,
        "line_end": 3,
        "column_start": 9,
        "column_end": 14
      },
      "name": "kiske",
      "qualname": "kiske$20",
      "value": "Person",
      "parent": null,
      "children": [],
      "decl_id": null,
      "docs": "",
      "sig": null,
      "attributes": []
    },
    {
      "kind": "Struct",
      "id": {
        "krate": 0,
        "index": 8
      },
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 97,
        "byte_end": 103,
        "line_start": 6,
        "line_end": 6,
        "column_start": 8,
        "column_end": 14
      },
      "name": "Person",
      "qualname": "::Person",
      "value": "Person { name, age }",
      "parent": null,
      "children": [
        {
          "krate": 0,
          "index": 19
        },
        {
          "krate": 0,
          "index": 21
        }
      ],
      "decl_id": null,
      "docs": "",
      "sig": null,
      "attributes": []
    },
    {
      "kind": "Field",
      "id": {
        "krate": 0,
        "index": 19
      },
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 114,
        "byte_end": 118,
        "line_start": 7,
        "line_end": 7,
        "column_start": 9,
        "column_end": 13
      },
      "name": "name",
      "qualname": "::Person::name",
      "value": "std::string::String",
      "parent": {
        "krate": 0,
        "index": 8
      },
      "children": [],
      "decl_id": null,
      "docs": "",
      "sig": null,
      "attributes": []
    },
    {
      "kind": "Field",
      "id": {
        "krate": 0,
        "index": 21
      },
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 136,
        "byte_end": 139,
        "line_start": 8,
        "line_end": 8,
        "column_start": 9,
        "column_end": 12
      },
      "name": "age",
      "qualname": "::Person::age",
      "value": "u32",
      "parent": {
        "krate": 0,
        "index": 8
      },
      "children": [],
      "decl_id": null,
      "docs": "",
      "sig": null,
      "attributes": []
    },
    {
      "kind": "Local",
      "id": {
        "krate": 0,
        "index": 4294967252
      },
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 174,
        "byte_end": 178,
        "line_start": 12,
        "line_end": 12,
        "column_start": 12,
        "column_end": 16
      },
      "name": "name",
      "qualname": "<Person>::new::name",
      "value": "&str",
      "parent": null,
      "children": [],
      "decl_id": null,
      "docs": "",
      "sig": null,
      "attributes": []
    },
    {
      "kind": "Local",
      "id": {
        "krate": 0,
        "index": 4294967247
      },
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 186,
        "byte_end": 189,
        "line_start": 12,
        "line_end": 12,
        "column_start": 24,
        "column_end": 27
      },
      "name": "age",
      "qualname": "<Person>::new::age",
      "value": "u32",
      "parent": null,
      "children": [],
      "decl_id": null,
      "docs": "",
      "sig": null,
      "attributes": []
    },
    {
      "kind": "Method",
      "id": {
        "krate": 0,
        "index": 12
      },
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 170,
        "byte_end": 173,
        "line_start": 12,
        "line_end": 12,
        "column_start": 8,
        "column_end": 11
      },
      "name": "new",
      "qualname": "<Person>::new",
      "value": "fn (name: &str, age: u32) -> Person",
      "parent": null,
      "children": [],
      "decl_id": null,
      "docs": "",
      "sig": null,
      "attributes": []
    }
  ],
  "impls": [
    {
      "id": 0,
      "kind": "Inherent",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 154,
        "byte_end": 160,
        "line_start": 11,
        "line_end": 11,
        "column_start": 6,
        "column_end": 12
      },
      "value": "",
      "parent": null,
      "children": [
        {
          "krate": 0,
          "index": 12
        }
      ],
      "docs": "",
      "sig": null,
      "attributes": []
    }
  ],
  "refs": [
    {
      "kind": "Function",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 24,
        "byte_end": 27,
        "line_start": 2,
        "line_end": 2,
        "column_start": 13,
        "column_end": 16
      },
      "ref_id": {
        "krate": 0,
        "index": 12
      }
    },
    {
      "kind": "Type",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 16,
        "byte_end": 22,
        "line_start": 2,
        "line_end": 2,
        "column_start": 5,
        "column_end": 11
      },
      "ref_id": {
        "krate": 0,
        "index": 8
      }
    },
    {
      "kind": "Function",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 69,
        "byte_end": 72,
        "line_start": 3,
        "line_end": 3,
        "column_start": 25,
        "column_end": 28
      },
      "ref_id": {
        "krate": 0,
        "index": 12
      }
    },
    {
      "kind": "Type",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 61,
        "byte_end": 67,
        "line_start": 3,
        "line_end": 3,
        "column_start": 17,
        "column_end": 23
      },
      "ref_id": {
        "krate": 0,
        "index": 8
      }
    },
    {
      "kind": "Type",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 120,
        "byte_end": 126,
        "line_start": 7,
        "line_end": 7,
        "column_start": 15,
        "column_end": 21
      },
      "ref_id": {
        "krate": 5,
        "index": 5584
      }
    },
    {
      "kind": "Type",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 154,
        "byte_end": 160,
        "line_start": 11,
        "line_end": 11,
        "column_start": 6,
        "column_end": 12
      },
      "ref_id": {
        "krate": 0,
        "index": 8
      }
    },
    {
      "kind": "Type",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 199,
        "byte_end": 205,
        "line_start": 12,
        "line_end": 12,
        "column_start": 37,
        "column_end": 43
      },
      "ref_id": {
        "krate": 0,
        "index": 8
      }
    },
    {
      "kind": "Type",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 216,
        "byte_end": 222,
        "line_start": 13,
        "line_end": 13,
        "column_start": 9,
        "column_end": 15
      },
      "ref_id": {
        "krate": 0,
        "index": 8
      }
    },
    {
      "kind": "Variable",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 237,
        "byte_end": 241,
        "line_start": 14,
        "line_end": 14,
        "column_start": 13,
        "column_end": 17
      },
      "ref_id": {
        "krate": 0,
        "index": 19
      }
    },
    {
      "kind": "Function",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 248,
        "byte_end": 257,
        "line_start": 14,
        "line_end": 14,
        "column_start": 24,
        "column_end": 33
      },
      "ref_id": {
        "krate": 5,
        "index": 4398
      }
    },
    {
      "kind": "Variable",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 243,
        "byte_end": 247,
        "line_start": 14,
        "line_end": 14,
        "column_start": 19,
        "column_end": 23
      },
      "ref_id": {
        "krate": 0,
        "index": 4294967252
      }
    },
    {
      "kind": "Variable",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 273,
        "byte_end": 276,
        "line_start": 15,
        "line_end": 15,
        "column_start": 13,
        "column_end": 16
      },
      "ref_id": {
        "krate": 0,
        "index": 21
      }
    },
    {
      "kind": "Variable",
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 273,
        "byte_end": 276,
        "line_start": 15,
        "line_end": 15,
        "column_start": 13,
        "column_end": 16
      },
      "ref_id": {
        "krate": 0,
        "index": 4294967247
      }
    }
  ],
  "macro_refs": [],
  "relations": [
    {
      "span": {
        "file_name": [
          109,
          97,
          105,
          110,
          46,
          114,
          115
        ],
        "byte_start": 154,
        "byte_end": 160,
        "line_start": 11,
        "line_end": 11,
        "column_start": 6,
        "column_end": 12
      },
      "kind": {
        "variant": "Impl",
        "fields": [
          0
        ]
      },
      "from": {
        "krate": 0,
        "index": 8
      },
      "to": {
        "krate": 4294967295,
        "index": 4294967295
      }
    }
  ]
}
```

<a id="unpretty-hir"></a>
## rustc -Zunpretty=hir

rustcのコンパイルオプション`-Zunpretty=hir`で`HIR`をdumpできる。
ソースはこのあたり

- [rust/src/librustc_driver/pretty.rs](https://github.com/rust-lang/rust/blob/de111e6367b065fd5f8cee59b64eefefd8272f44/src/librustc_driver/pretty.rs)
- [rust/src/librustc/hir/print.rs](https://github.com/rust-lang/rust/blob/de111e6367b065fd5f8cee59b64eefefd8272f44/src/librustc/hir/print.rs)

以下のファイルを`rustc -Zunpretty=hir main.rs`でdumpしてみる。

```rust
#[prelude_import]
use std::prelude::v1::*;
#[macro_use]
extern crate std;
fn main() {
    <Person>::new("not_bind", 18);
    let kiske = <Person>::new("kiske", 18);
}

struct Person {
    pub name: String,
    pub age: u32,
}

impl Person {
    fn new(name: &str, age: u32) -> Person {
        Person {
            name: name.to_string(),
            age,
        }
    }
}
```

<a id="unpretty-hir-identified"></a>
## rustc -Zunpretty="hir,identified"

rustcのコンパイルオプション`-Zunpretty="hir,identified"`で`HIR`をnode_id付きでdumpできる。
以下のファイルを`rustc -Zunpretty="hir,identified" main.rs`でdumpしてみる。

```rust
#[prelude_import]
use ::std::prelude::v1::*; /* node_id: 3 hir local_id: 0 */
#[macro_use]
extern crate std; /* node_id: 9 hir local_id: 0 */
fn main() ({
               ((<Person>::new /* node_id: 15 hir local_id: 5
                    */)(("not_bind" /* node_id: 16 hir local_id: 6 */),
                        (18 /* node_id: 17 hir local_id: 7 */)) /*
                   node_id: 18 hir local_id: 8 */);
               let kiske /* pat node_id: 20 hir local_id: 10 */ =
                   ((<Person>::new /* node_id: 23 hir local_id: 14
                        */)(("kiske" /* node_id: 24 hir local_id: 15 */),
                            (18 /* node_id: 25 hir local_id: 16 */)) /*
                       node_id: 26 hir local_id: 17 */);
           } /* block node_id: 12 hir local_id: 19 */ /*
              node_id: 67 hir local_id: 20 */) /* node_id: 10 hir local_id: 0
*/

struct Person {
    pub name: String,
    pub age: u32,
} /* node_id: 27 hir local_id: 0 */

impl Person {
    fn new(name /* pat node_id: 43 hir local_id: 14 */: &str,
           age /* pat node_id: 48 hir local_id: 16 */: u32)
     ->
         Person ({
                     (Person{name:
                                 ((name /* node_id: 57 hir local_id: 5
                                      */).to_string() /*
                                     node_id: 58 hir local_id: 6 */),
                             (age /* node_id: 60 hir local_id: 9 */),} /*
                         node_id: 61 hir local_id: 10 */)
                 } /* block node_id: 53 hir local_id: 11 */ /*
                    node_id: 70 hir local_id: 12 */)
    /*
    40
    */
} /* node_id: 36 hir local_id: 0 */
```


<a id="unpretty-hir-typed"></a>
## rustc -Zunpretty="hir,typed"

rustcのコンパイルオプション`-Zunpretty="hir,typed"`で`HIR`を型情報付きでdumpできる。
以下のファイルを`rustc -Zunpretty="hir,typed" main.rs`でdumpしてみる。

```rust
#[prelude_import]
use ::std::prelude::v1::*;
#[macro_use]
extern crate std;
fn main() ({
               ((<Person>::new as
                    for<'r> fn(&'r str, u32) -> Person {Person::new})(("not_bind"
                                                                          as
                                                                          &'static str),
                                                                      (18 as
                                                                          u32))
                   as Person);
               let kiske =
                   ((<Person>::new as
                        for<'r> fn(&'r str, u32) -> Person {Person::new})(("kiske"
                                                                              as
                                                                              &'static str),
                                                                          (18
                                                                              as
                                                                              u32))
                       as Person);
           } as ())

struct Person {
    pub name: String,
    pub age: u32,
}

impl Person {
    fn new(name: &str, age: u32)
     ->
         Person ({
                     (Person{name:
                                 ((name as &str).to_string() as
                                     std::string::String),
                             (age as u32),} as Person)
                 } as Person)
}
```

<a id="unpretty-hir-tree"></a>
## rustc -Zunpretty=hir-tree

rustcのコンパイルオプション`-Zunpretty=hir-tree`で`HIR`をtreeのままdumpできる。
以下のファイルを`rustc -Zunpretty=hir-tree main.rs`でdumpしてみる。


```rust
Crate {
    module: Mod {
        inner: Span {
            lo: BytePos(
                0
            ),
            hi: BytePos(
                294
            ),
            ctxt: #0
        },
        item_ids: [
            ItemId {
                id: NodeId(3)
            },
            ItemId {
                id: NodeId(9)
            },
            ItemId {
                id: NodeId(10)
            },
            ItemId {
                id: NodeId(27)
            },
            ItemId {
                id: NodeId(36)
            }
        ]
    },
    attrs: [],
    span: Span {
        lo: BytePos(
            0
        ),
        hi: BytePos(
            294
        ),
        ctxt: #0
    },
    exported_macros: [],
    items: {
        NodeId(3): Item {
            ident: #0,
            id: NodeId(3),
            hir_id: HirId {
                owner: DefIndex(0:1),
                local_id: 0
            },
            attrs: [
                Attribute {
                    id: AttrId(
                        1
                    ),
                    style: Outer,
                    path: path(prelude_import),
                    tokens: TokenStream(
                        None
                    ),
                    is_sugared_doc: false,
                    span: Span {
                        lo: BytePos(
                            0
                        ),
                        hi: BytePos(
                            0
                        ),
                        ctxt: #1
                    }
                }
            ],
            node: Use(
                path(::std::prelude::v1),
                Glob
            ),
            vis: Spanned {
                node: Inherited,
                span: Span {
                    lo: BytePos(
                        0
                    ),
                    hi: BytePos(
                        0
                    ),
                    ctxt: #1
                }
            },
            span: Span {
                lo: BytePos(
                    0
                ),
                hi: BytePos(
                    0
                ),
                ctxt: #1
            }
        },
        NodeId(9): Item {
            ident: std#0,
            id: NodeId(9),
            hir_id: HirId {
                owner: DefIndex(0:2),
                local_id: 0
            },
            attrs: [
                Attribute {
                    id: AttrId(
                        0
                    ),
                    style: Outer,
                    path: path(macro_use),
                    tokens: TokenStream(
                        None
                    ),
                    is_sugared_doc: false,
                    span: Span {
                        lo: BytePos(
                            0
                        ),
                        hi: BytePos(
                            0
                        ),
                        ctxt: #0
                    }
                }
            ],
            node: ExternCrate(
                None
            ),
            vis: Spanned {
                node: Inherited,
                span: Span {
                    lo: BytePos(
                        0
                    ),
                    hi: BytePos(
                        0
                    ),
                    ctxt: #0
                }
            },
            span: Span {
                lo: BytePos(
                    0
                ),
                hi: BytePos(
                    0
                ),
                ctxt: #0
            }
        },
        NodeId(10): Item {
            ident: main#0,
            id: NodeId(10),
            hir_id: HirId {
                owner: DefIndex(0:3),
                local_id: 0
            },
            attrs: [],
            node: Fn(
                FnDecl {
                    inputs: [],
                    output: DefaultReturn(
                        Span {
                            lo: BytePos(
                                10
                            ),
                            hi: BytePos(
                                10
                            ),
                            ctxt: #0
                        }
                    ),
                    variadic: false,
                    implicit_self: None
                },
                FnHeader {
                    unsafety: Normal,
                    constness: NotConst,
                    asyncness: NotAsync,
                    abi: Rust
                },
                Generics {
                    params: [],
                    where_clause: WhereClause {
                        id: NodeId(11),
                        hir_id: HirId {
                            owner: DefIndex(0:3),
                            local_id: 21
                        },
                        predicates: []
                    },
                    span: Span {
                        lo: BytePos(
                            0
                        ),
                        hi: BytePos(
                            0
                        ),
                        ctxt: #0
                    }
                },
                BodyId {
                    node_id: NodeId(67)
                }
            ),
            vis: Spanned {
                node: Inherited,
                span: Span {
                    lo: BytePos(
                        0
                    ),
                    hi: BytePos(
                        0
                    ),
                    ctxt: #0
                }
            },
            span: Span {
                lo: BytePos(
                    0
                ),
                hi: BytePos(
                    88
                ),
                ctxt: #0
            }
        },
        NodeId(27): Item {
            ident: Person#0,
            id: NodeId(27),
            hir_id: HirId {
                owner: DefIndex(0:4),
                local_id: 0
            },
            attrs: [],
            node: Struct(
                Struct(
                    [
                        StructField {
                            span: Span {
                                lo: BytePos(
                                    110
                                ),
                                hi: BytePos(
                                    126
                                ),
                                ctxt: #0
                            },
                            ident: name#0,
                            vis: Spanned {
                                node: Public,
                                span: Span {
                                    lo: BytePos(
                                        110
                                    ),
                                    hi: BytePos(
                                        113
                                    ),
                                    ctxt: #0
                                }
                            },
                            id: NodeId(28),
                            hir_id: HirId {
                                owner: DefIndex(0:4),
                                local_id: 2
                            },
                            ty: type(String),
                            attrs: []
                        },
                        StructField {
                            span: Span {
                                lo: BytePos(
                                    132
                                ),
                                hi: BytePos(
                                    144
                                ),
                                ctxt: #0
                            },
                            ident: age#0,
                            vis: Spanned {
                                node: Public,
                                span: Span {
                                    lo: BytePos(
                                        132
                                    ),
                                    hi: BytePos(
                                        135
                                    ),
                                    ctxt: #0
                                }
                            },
                            id: NodeId(31),
                            hir_id: HirId {
                                owner: DefIndex(0:4),
                                local_id: 5
                            },
                            ty: type(u32),
                            attrs: []
                        }
                    ],
                    NodeId(34),
                    HirId {
                        owner: DefIndex(0:4),
                        local_id: 1
                    }
                ),
                Generics {
                    params: [],
                    where_clause: WhereClause {
                        id: NodeId(35),
                        hir_id: HirId {
                            owner: DefIndex(0:4),
                            local_id: 8
                        },
                        predicates: []
                    },
                    span: Span {
                        lo: BytePos(
                            0
                        ),
                        hi: BytePos(
                            0
                        ),
                        ctxt: #0
                    }
                }
            ),
            vis: Spanned {
                node: Inherited,
                span: Span {
                    lo: BytePos(
                        90
                    ),
                    hi: BytePos(
                        90
                    ),
                    ctxt: #0
                }
            },
            span: Span {
                lo: BytePos(
                    90
                ),
                hi: BytePos(
                    147
                ),
                ctxt: #0
            }
        },
        NodeId(36): Item {
            ident: #0,
            id: NodeId(36),
            hir_id: HirId {
                owner: DefIndex(0:5),
                local_id: 0
            },
            attrs: [],
            node: Impl(
                Normal,
                "positive",
                Final,
                Generics {
                    params: [],
                    where_clause: WhereClause {
                        id: NodeId(37),
                        hir_id: HirId {
                            owner: DefIndex(0:5),
                            local_id: 1
                        },
                        predicates: []
                    },
                    span: Span {
                        lo: BytePos(
                            0
                        ),
                        hi: BytePos(
                            0
                        ),
                        ctxt: #0
                    }
                },
                None,
                type(Person),
                [
                    ImplItemRef {
                        id: ImplItemId {
                            node_id: NodeId(40)
                        },
                        ident: new#0,
                        kind: Method {
                            has_self: false
                        },
                        span: Span {
                            lo: BytePos(
                                167
                            ),
                            hi: BytePos(
                                292
                            ),
                            ctxt: #0
                        },
                        vis: Spanned {
                            node: Inherited,
                            span: Span {
                                lo: BytePos(
                                    167
                                ),
                                hi: BytePos(
                                    167
                                ),
                                ctxt: #0
                            }
                        },
                        defaultness: Final
                    }
                ]
            ),
            vis: Spanned {
                node: Inherited,
                span: Span {
                    lo: BytePos(
                        149
                    ),
                    hi: BytePos(
                        149
                    ),
                    ctxt: #0
                }
            },
            span: Span {
                lo: BytePos(
                    149
                ),
                hi: BytePos(
                    294
                ),
                ctxt: #0
            }
        }
    },
    trait_items: {},
    impl_items: {
        ImplItemId {
            node_id: NodeId(40)
        }: ImplItem {
            id: NodeId(40),
            ident: new#0,
            hir_id: HirId {
                owner: DefIndex(0:6),
                local_id: 0
            },
            vis: Spanned {
                node: Inherited,
                span: Span {
                    lo: BytePos(
                        167
                    ),
                    hi: BytePos(
                        167
                    ),
                    ctxt: #0
                }
            },
            defaultness: Final,
            attrs: [],
            generics: Generics {
                params: [],
                where_clause: WhereClause {
                    id: NodeId(41),
                    hir_id: HirId {
                        owner: DefIndex(0:6),
                        local_id: 17
                    },
                    predicates: []
                },
                span: Span {
                    lo: BytePos(
                        0
                    ),
                    hi: BytePos(
                        0
                    ),
                    ctxt: #0
                }
            },
            node: Method(
                MethodSig {
                    header: FnHeader {
                        unsafety: Normal,
                        constness: NotConst,
                        asyncness: NotAsync,
                        abi: Rust
                    },
                    decl: FnDecl {
                        inputs: [
                            type(&str),
                            type(u32)
                        ],
                        output: Return(
                            type(Person)
                        ),
                        variadic: false,
                        implicit_self: None
                    }
                },
                BodyId {
                    node_id: NodeId(70)
                }
            ),
            span: Span {
                lo: BytePos(
                    167
                ),
                hi: BytePos(
                    292
                ),
                ctxt: #0
            }
        }
    },
    bodies: {
        BodyId {
            node_id: NodeId(67)
        }: Body {
            arguments: [],
            value: expr(67: { <Person>::new("not_bind", 18); let kiske = <Person>::new("kiske", 18); }),
            is_generator: false
        },
        BodyId {
            node_id: NodeId(70)
        }: Body {
            arguments: [
                Arg {
                    pat: pat(43: name),
                    id: NodeId(42),
                    hir_id: HirId {
                        owner: DefIndex(0:6),
                        local_id: 13
                    }
                },
                Arg {
                    pat: pat(48: age),
                    id: NodeId(47),
                    hir_id: HirId {
                        owner: DefIndex(0:6),
                        local_id: 15
                    }
                }
            ],
            value: expr(70: { Person{name: name.to_string(), age,} }),
            is_generator: false
        }
    },
    trait_impls: {},
    trait_auto_impl: {},
    body_ids: [
        BodyId {
            node_id: NodeId(67)
        },
        BodyId {
            node_id: NodeId(70)
        }
    ],
    modules: {
        NodeId(0): ModuleItems {
            items: {
                NodeId(3),
                NodeId(9),
                NodeId(10),
                NodeId(27),
                NodeId(36)
            },
            trait_items: {},
            impl_items: {
                ImplItemId {
                    node_id: NodeId(40)
                }
            }
        }
    }
}
```

