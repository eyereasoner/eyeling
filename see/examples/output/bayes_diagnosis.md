# Bayes Diagnosis  

## Entailment  
The most likely disease is COVID-19 (posterior = 0.941209).  

Full posterior distribution:  
  COVID-19              posterior = 0.941209  (unnormalized = 0.00154700)  
  Influenza             posterior = 0.029204  (unnormalized = 0.00004800)  
  Allergic rhinitis     posterior = 0.000456  (unnormalized = 0.00000075)  
  Bacterial pneumonia   posterior = 0.029131  (unnormalized = 0.00004788)  

## Explanation  
Evidence: Fever=present, DryCough=present, LossOfSmell=present, Sneezing=absent, ShortBreath=present. Evidence total (normalizing constant) = 0.00164363. Each posterior is prior(d) times the product of symptom likelihood factors, divided by the evidence total.  

**Generated derivation support**  

Compiled support: 85 source fact(s), 9 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 10 (3 premise pattern(s) => 2 conclusion pattern(s)) derives :Case :scores (0.001547 0.000048 7.5e-7 0.00004788) ., :Case :evidenceTotal 0.00164363 .  
  - Uses: :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
- Rule 11 (6 premise pattern(s) => 5 conclusion pattern(s)) derives _:r11_6fcdcfca2e82_headBlank30 :disease :COVID19 ., _:r11_6fcdcfca2e82_headBlank30 :unnormalized 0.001547 ., _:r11_6fcdcfca2e82_headBlank30 :posterior 0.941209396275317 ., :Case :result _:r11_6fcdcfca2e82_headBlank30 ., … +16 more  
  - Uses: :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_; :Case :scores (0.001547 0.000048 7.5e-7 0.00004788) . _(derived)_; :Case :evidenceTotal 0.00164363 . _(derived)_  
- Rule 12 (11 premise pattern(s) => 2 conclusion pattern(s)) derives :Case :winner :COVID19 ., :Case :winnerPosterior 0.941209396275317 .  
  - Uses: _:r11_6fcdcfca2e82_headBlank30 :disease :COVID19 . _(derived)_; _:r11_6fcdcfca2e82_headBlank30 :posterior 0.941209396275317 . _(derived)_; :Case :result _:r11_6fcdcfca2e82_headBlank30 . _(derived)_; :COVID19 :posterior 0.941209396275317 . _(derived)_; … +3 more premise fact(s)  
- Rule 13 (13 premise pattern(s) => 2 conclusion pattern(s)) derives :bayesDiagnosis log:outputString "[authored report]" ., :bayesDiagnosis :recommends :COVID19 .  
  - Uses: :Case :winner :COVID19 . _(derived)_; :Case :winnerPosterior 0.941209396275317 . _(derived)_; :Case :evidenceTotal 0.00164363 . _(derived)_; :COVID19 :label "COVID-19" . _(source)_; … +4 more premise fact(s)  

Selected explanation support:  
  - :bayesDiagnosis :recommends :COVID19 . _(derived by Rule 13)_  
    - :Case :winner :COVID19 . _(derived by Rule 12)_  
      - _:r11_6fcdcfca2e82_headBlank30 :disease :COVID19 . _(derived by Rule 11)_  
        - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :scores (0.001547 0.000048 7.5e-7 0.00004788) . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :evidenceTotal 0.00164363 . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
      - _:r11_6fcdcfca2e82_headBlank30 :posterior 0.941209396275317 . _(derived by Rule 11)_  
        - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :scores (0.001547 0.000048 7.5e-7 0.00004788) . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :evidenceTotal 0.00164363 . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
      - :Case :result _:r11_6fcdcfca2e82_headBlank30 . _(derived by Rule 11)_  
        - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :scores (0.001547 0.000048 7.5e-7 0.00004788) . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :evidenceTotal 0.00164363 . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
      - :COVID19 :posterior 0.941209396275317 . _(derived by Rule 11)_  
        - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :scores (0.001547 0.000048 7.5e-7 0.00004788) . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :evidenceTotal 0.00164363 . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
      - ... 3 more premise fact(s)  
    - :Case :winnerPosterior 0.941209396275317 . _(derived by Rule 12)_  
      - _:r11_6fcdcfca2e82_headBlank30 :disease :COVID19 . _(derived by Rule 11)_  
        - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :scores (0.001547 0.000048 7.5e-7 0.00004788) . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :evidenceTotal 0.00164363 . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
      - _:r11_6fcdcfca2e82_headBlank30 :posterior 0.941209396275317 . _(derived by Rule 11)_  
        - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :scores (0.001547 0.000048 7.5e-7 0.00004788) . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
        - :Case :evidenceTotal 0.00164363 . _(derived by Rule 10)_  
          - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
      - ... 3 more premise fact(s)  
    - ... 4 more premise fact(s)  
  - … support tree truncated after 40 line(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/bayes-diagnosis#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix list: <http://www.w3.org/2000/10/swap/list#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:bayesDiagnosis :recommends :COVID19 .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "bayes_diagnosis" .  
  in:run see:title "Bayes Diagnosis" .  
  in:run see:sourceFile "examples/n3/bayes_diagnosis.n3" .  
  in:run see:sourceSHA256 "46feebe5109b413a4143b7bcb4bc77ac6c0b18a8fdd8f6a62ab06c42287035d9" .  
  in:run see:description "Naive Bayes diagnosis example, adapted from Eyeling's bayes-diagnosis.n3.\nThe facts and rules compute unnormalized likelihoods, normalize them into\nposterior probabilities, and emit a SEE report for the highest posterior.\nValues are illustrative only and are not medical advice." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 85 .  
  in:run see:compiledRules 4 .  
  in:run see:compiledBackwardRules 5 .  
  in:run see:compiledFuses 4 .  
  in:run see:compiledQueries 1 .  
}  
```  

