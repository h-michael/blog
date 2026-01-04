---
title: "[Memo] Rustc Overview - librustc_driver"
pubDatetime: 2019-02-03T11:56:37+09:00
description: "Rustコンパイラのlibrustc_driverの概要メモ"
tags:
  - rust
  - compiler
  - memo
draft: false
---


# [rustc](https://github.com/rust-lang/rust/tree/ee229f7fd060b9ff3cd5df4556dd550a3df0b62f/src/rustc)

# [librustc_driver](https://github.com/rust-lang/rust/tree/ee229f7fd060b9ff3cd5df4556dd550a3df0b62f/src/librustc_driver)

## [main](https://github.com/rust-lang/rust/blob/ee229f7fd060b9ff3cd5df4556dd550a3df0b62f/src/librustc_driver/lib.rs#L1630)
 - run
  - run_compiler
  - process::exit

### [run_compiler_with_pool](https://github.com/rust-lang/rust/blob/ee229f7fd060b9ff3cd5df4556dd550a3df0b62f/src/librustc_driver/lib.rs#L433)
- rustc_lint::register_builtins
- driver::compile_input
 - [phase_1_parse_input](#phase_1)
 - CompileState::state_after_parse
 - controller_entry_point!
 - build_output_filenames
 - ::rustc_codegen_utils:: link ::find_crate_name
 - install_panic_hook
 - [phase_2_configure_and_expand](#phase_2)
 - generated_output_paths
 - write_out_deps
 - hir_map::map_crate
 - hir_map.dep_graph.assert_ignored
 - controller_entry_point!
 - AllArenas::new
 - [phase_3_run_analysis_passes](#phase_3)
  - [phase_4_codegen](#phase_4)
 - codegen_backend.join_codegen_and_link
 - controller_entry_point!

<a id="phase_1"></a>
#### [phase_1_parse_input](https://github.com/rust-lang/rust/blob/ee229f7fd060b9ff3cd5df4556dd550a3df0b62f/src/librustc_driver/driver.rs#L644)
- hygiene::set_default_edition(sess.edition());
- parse::parse_crate_from_file(file, &sess.parse_sess) || parse::parse_crate_from_source_str(name.clone(), input.clone(), &sess.parse_sess)

<a id="phase_2"></a>
#### [phase_2_configure_and_expand](https://github.com/rust-lang/rust/blob/ee229f7fd060b9ff3cd5df4556dd550a3df0b62f/src/librustc_driver/driver.rs#L721)

> Run the "early phases" of the compiler: initial `cfg` processing,
> loading compiler plugins (including those from `addl_plugins`),
> syntax expansion, secondary `cfg` expansion, synthesis of a test
> harness if one is to be provided, injection of a dependency on the
> standard library and prelude, and name resolution.
> 
> Returns `None` if we're aborting after handling -W help.
> 
> Currently, we ignore the name resolution data structures for the purposes of dependency
> tracking. Instead we will run name resolution and include its output in the hash of each
> item, much like we do for macro expansion. In other words, the hash reflects not just
> its contents but the results of name resolution on those contents. Hopefully we'll push
> this back at some point.

- CrateLoader::new(sess, &cstore, &crate_name);
-  Resolver::arenas();
-  phase_2_configure_and_expand_inner(

##### [phase_2_configure_and_expand_inner](https://github.com/rust-lang/rust/blob/ee229f7fd060b9ff3cd5df4556dd550a3df0b62f/src/librustc_driver/driver.rs#L778)

> Same as phase_2_configure_and_expand, but doesn't let you keep the resolver around

- syntax::attr::inject
- syntax::config::features
- collect_crate_types
- compute_crate_disambiguator
- rustc_incremental::prepare_session_directory
- rustc_incremental::load_dep_graph
- middle::recursion_limit::update_limits
- syntax::std_inject::maybe_inject_crates_ref
- plugin::load::load_plugins
- Registry::new
- registry.register_macro("__diagnostic_used", diagnostics::plugin::expand_diagnostic_used,);
- registry.register_macro("__register_diagnostic", diagnostics::plugin::expand_register_diagnostic,);
- registry.register_macro("__build_diagnostic_array", diagnostics::plugin::expand_build_diagnostic_array,;
- lint::check_ast_crate
- Resolver::new
- syntax_ext::register_builtins
- krate = time(sess, "expansion", || { ... })
- krate = time(sess, "maybe building test harness", || { ... })
- ast_validation::check_crate(sess, &krate)
- after_expand
- resolver.resolve_crate(&krate)
- syntax::feature_gate::check_crate
- lower_crate
- hir_map::Forest::new
- lint::check_ast_crate

<a id="phase_3"></a>
#### [phase_3_run_analysis_passes](https://github.com/rust-lang/rust/blob/ee229f7fd060b9ff3cd5df4556dd550a3df0b62f/src/librustc_driver/driver.rs#L1173)

> Run the resolution, typechecking, region checking and other
> miscellaneous analysis passes on the crate. Return various
> structures carrying the results of the analysis.

- rustc_incremental::load_query_result_cache
- ty::query::Providers::default
- default_provide
- codegen_backend.provide
- default_provide_extern
- codegen_backend.provide_extern
- TyCtxt::create_and_enter

<a id="phase_4"></a>
##### [phase_4_codegen](https://github.com/rust-lang/rust/blob/ee229f7fd060b9ff3cd5df4556dd550a3df0b62f/src/librustc_driver/driver.rs#L1325)

> Run the codegen backend, after which the AST and analysis can be discarded.

- ::rustc::middle::dependency_format::calculate
- codegen_backend.codegen_crate
