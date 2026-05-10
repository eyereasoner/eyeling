# crypto builtins tests  

## Conclusion  
The derivation produced 4 new fact(s) from 0 stated fact(s).  
Main conclusion: **:ok_crypto_sha512_1 is a :Pass.**  

Selected conclusions:  
- :ok_crypto_sha512_1 rdf:type :Pass .  
- :ok_crypto_sha256_1 rdf:type :Pass .  
- :ok_crypto_md5_1 rdf:type :Pass .  
- :ok_crypto_sha_1 rdf:type :Pass .  

## Explanation  
Starts with 0 source fact(s), applies 4 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 1: "hello world" crypto:sha "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed" => :ok_crypto_sha_1 rdf:type :Pass derives :ok_crypto_sha_1 rdf:type :Pass .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  
- Rule 2: "hello world" crypto:md5 "5eb63bbbe01eeed093cb22bb8f5acdc3" => :ok_crypto_md5_1 rdf:type :Pass derives :ok_crypto_md5_1 rdf:type :Pass .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  
- Rule 3: "hello world" crypto:sha256 "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9" => :ok_crypto_sha256_1 rdf:type :Pass derives :ok_crypto_sha256_1 rdf:type :Pass .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  
- Rule 4: "hello world" crypto:sha512 "309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f" => :ok_crypto_sha512_1 rdf:type :Pass derives :ok_crypto_sha512_1 rdf:type :Pass .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  

Selected explanation support:  
  - :ok_crypto_sha512_1 rdf:type :Pass . _(derived by Rule 4)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :ok_crypto_sha256_1 rdf:type :Pass . _(derived by Rule 3)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :ok_crypto_md5_1 rdf:type :Pass . _(derived by Rule 2)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :ok_crypto_sha_1 rdf:type :Pass . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/crypto-builtins-tests#> .  
@prefix crypto: <http://www.w3.org/2000/10/swap/crypto#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:ok_crypto_sha_1 rdf:type :Pass .  
:ok_crypto_md5_1 rdf:type :Pass .  
:ok_crypto_sha256_1 rdf:type :Pass .  
:ok_crypto_sha512_1 rdf:type :Pass .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "crypto_builtins_tests" .  
  in:run see:title "crypto builtins tests" .  
  in:run see:sourceFile "examples/n3/crypto_builtins_tests.n3" .  
  in:run see:sourceSHA256 "36867ada425da37071cbc96e74a10311adbfe437adf3d8e56b4a1d95a23763b5" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 0 .  
  in:run see:compiledRules 4 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

