# Bayes Therapy  

## Entailment  
Recommended therapy: Paxlovid (utility = 3.585174).  
expected success : 0.388517  
adverse probability : 0.100000  

Therapy utilities:  
  Paxlovid        utility = 3.585174  success = 0.388517  adverse = 0.100000  
  Oseltamivir     utility = 2.611410  success = 0.285141  adverse = 0.080000  
  Supportive care utility = 2.885120  success = 0.291512  adverse = 0.010000  
  Antibiotic      utility = 0.899526  success = 0.110953  adverse = 0.070000  
  Antihistamine   utility = 0.912689  success = 0.100269  adverse = 0.030000  

## Explanation  
The N3 source first computes disease posteriors from the symptom evidence. It then combines those posterior probabilities with therapy-specific success probabilities, subtracting the weighted adverse-effect penalty from the weighted expected benefit.  

**Generated derivation support**  

Compiled support: 104 source fact(s), 20 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 20 (5 premise pattern(s) => 3 conclusion pattern(s)) derives :Case :scores (0.009282 0.008208 0.00012825 0.00156408) ., :Case :evidenceTotal 0.01918233 ., :Case :posteriors (0.48388282341092 0.42789379600914 0.00668584056264281 0.0815375400172972) .  
  - Uses: :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
- Rule 21 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :COVID19 :posterior 0.48388282341092 ., :Influenza :posterior 0.42789379600914 ., :AllergicRhinitis :posterior 0.00668584056264281 ., :BacterialPneumonia :posterior 0.0815375400172972 .  
  - Uses: :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_; :Case :posteriors (0.48388282341092 0.42789379600914 0.00668584056264281 0.0815375400172972) . _(derived)_  
- Rule 22 (12 premise pattern(s) => 3 conclusion pattern(s)) derives :Paxlovid :expectedSuccess 0.388517401170765 ., :Paxlovid :expectedAdverse 0.1 ., :Paxlovid :utility 3.58517401170765 ., :Oseltamivir :expectedSuccess 0.285141012588148 ., … +11 more  
  - Uses: :Case :posteriors (0.48388282341092 0.42789379600914 0.00668584056264281 0.0815375400172972) . _(derived)_; :Paxlovid rdf:type :Therapy . _(source)_; :Paxlovid :successByDisease (0.75 0.05 0.02 0.05) . _(source)_; :Paxlovid :adverse 0.1 . _(source)_; … +14 more premise fact(s)  
- Rule 27: :Case :therapies ?ts; (?ts) :bestTherapy ?best => :Case :recommendedTherapy ?best derives :Case :recommendedTherapy :Paxlovid .  
  - Uses: :Case :therapies (:Paxlovid :Oseltamivir :SupportiveCare :Antibiotic :Antihistamine) . _(source)_  
- Rule 28 (21 premise pattern(s) => 2 conclusion pattern(s)) derives :bayesTherapy log:outputString "[authored report]" ., :bayesTherapy :recommends :Paxlovid .  
  - Uses: :Case :recommendedTherapy :Paxlovid . _(derived)_; :Paxlovid :label "Paxlovid" . _(source)_; :Paxlovid :expectedSuccess 0.388517401170765 . _(derived)_; :Paxlovid :expectedAdverse 0.1 . _(derived)_; … +13 more premise fact(s)  

Selected explanation support:  
  - :bayesTherapy :recommends :Paxlovid . _(derived by Rule 28)_  
    - :Case :recommendedTherapy :Paxlovid . _(derived by Rule 27)_  
      - :Case :therapies (:Paxlovid :Oseltamivir :SupportiveCare :Antibiotic :Antihistamine) . _(source)_  
    - :Paxlovid :label "Paxlovid" . _(source)_  
    - :Paxlovid :expectedSuccess 0.388517401170765 . _(derived by Rule 22)_  
      - :Case :posteriors (0.48388282341092 0.42789379600914 0.00668584056264281 0.0815375400172972) . _(derived by Rule 20)_  
        - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
      - :Paxlovid rdf:type :Therapy . _(source)_  
      - :Paxlovid :successByDisease (0.75 0.05 0.02 0.05) . _(source)_  
      - :Paxlovid :adverse 0.1 . _(source)_  
      - ... 2 more premise fact(s)  
    - :Paxlovid :expectedAdverse 0.1 . _(derived by Rule 22)_  
      - :Case :posteriors (0.48388282341092 0.42789379600914 0.00668584056264281 0.0815375400172972) . _(derived by Rule 20)_  
        - :Case :diseases (:COVID19 :Influenza :AllergicRhinitis :BacterialPneumonia) . _(source)_  
      - :Paxlovid rdf:type :Therapy . _(source)_  
      - :Paxlovid :successByDisease (0.75 0.05 0.02 0.05) . _(source)_  
      - :Paxlovid :adverse 0.1 . _(source)_  
      - ... 2 more premise fact(s)  
    - ... 13 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/bayes-therapy#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix list: <http://www.w3.org/2000/10/swap/list#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:bayesTherapy :recommends :Paxlovid .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "bayes_therapy" .  
  in:run see:title "Bayes Therapy" .  
  in:run see:sourceFile "examples/n3/bayes_therapy.n3" .  
  in:run see:sourceSHA256 "18244b81f37328f7d77c8e88a4749891c3d773ffbf19affecd7f118c6208395d" .  
  in:run see:description "Extends the Bayesian diagnosis model with a therapy utility layer. Adapted\nfrom Eyeling's bayes-therapy.n3. Values are illustrative only and are not\nmedical advice." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 104 .  
  in:run see:compiledRules 5 .  
  in:run see:compiledBackwardRules 15 .  
  in:run see:compiledFuses 8 .  
  in:run see:compiledQueries 1 .  
}  
```  

