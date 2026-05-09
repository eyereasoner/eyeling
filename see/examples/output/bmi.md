# BMI — Body Mass Index example.  

## Insight  
BMI = 22.72  
Category = Normal  
At height 178 cm, a healthy-weight range is about 58.6–78.9 kg (BMI 18.5–24.9).  

## Explanation  
BMI is defined as weight in kilograms divided by height in meters squared. This program first normalizes the input to SI units, computes BMI, and then applies WHO adult categories as half-open intervals. The healthy-weight band is the weight range at the same height that corresponds to BMI 18.5 through 24.9.  

**Generated derivation support**  

Compiled support: 3 source fact(s), 12 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (4 premise pattern(s) => 3 conclusion pattern(s)) derives :Case :weightKg 72 ., :Case :heightM 1.78 ., :Reason :units "Inputs were already metric, so kilograms stay kilograms and centimeters are divided by 100 to obtain meters." .  
  - Uses: :Input :unitSystem "metric" . _(source)_; :Input :weight 72 . _(source)_; :Input :height 178 . _(source)_  
- Rule 3 (15 premise pattern(s) => 7 conclusion pattern(s)) derives :Case :heightSquared 3.1684 ., :Case :bmi 22.7244034844085 ., :Case :bmiRounded 22.72 ., :Case :healthyMinKg 58.6154 ., … +3 more  
  - Uses: :Case :weightKg 72 . _(derived)_; :Case :heightM 1.78 . _(derived)_  
- Rule 5 (3 premise pattern(s) => 1 conclusion pattern(s)) derives :Decision :category "Normal" .  
  - Uses: :Case :bmi 22.7244034844085 . _(derived)_  
- Rule 10 (7 premise pattern(s) => 5 conclusion pattern(s)) derives :Answer :bmi 22.72 ., :Answer :category "Normal" ., :Answer :healthyMinKg 58.6 ., :Answer :healthyMaxKg 78.9 ., … +1 more  
  - Uses: :Case :bmiRounded 22.72 . _(derived)_; :Case :healthyMinKgRounded 58.6 . _(derived)_; :Case :healthyMaxKgRounded 78.9 . _(derived)_; :Case :heightM 1.78 . _(derived)_; … +1 more premise fact(s)  
- Rule 11 (6 premise pattern(s) => 4 conclusion pattern(s)) derives :Reason :formula "BMI is defined as weight in kilograms divided by height in meters squared." ., :Reason :calculation "The normalized weight and height were used to compute BMI, then the result was mapped to the WHO adult category table." ., :Reason :categoryRule "Normal" ., :Reason :unitsExplanation "Inputs were already metric, so kilograms stay kilograms and centimeters are divided by 100 to obtain meters." .  
  - Uses: :Case :weightKg 72 . _(derived)_; :Case :heightM 1.78 . _(derived)_; :Case :heightSquared 3.1684 . _(derived)_; :Case :bmiRounded 22.72 . _(derived)_; … +2 more premise fact(s)  
- Rule 13 (6 premise pattern(s) => 1 conclusion pattern(s)) derives :report log:outputString "[authored report]" .  
  - Uses: :Answer :bmi 22.72 . _(derived)_; :Answer :category "Normal" . _(derived)_; :Answer :healthyMinKg 58.6 . _(derived)_; :Answer :healthyMaxKg 78.9 . _(derived)_; … +1 more premise fact(s)  

Selected explanation support:  
  - :report log:outputString "[authored report]" . _(authored report, Rule 13)_  
  - :Reason :unitsExplanation "Inputs were already metric, so kilograms stay kilograms and centimeters are divided by 100 to obtain meters." . _(derived by Rule 11)_  
    - :Case :weightKg 72 . _(derived by Rule 1)_  
      - :Input :unitSystem "metric" . _(source)_  
      - :Input :weight 72 . _(source)_  
      - :Input :height 178 . _(source)_  
    - :Case :heightM 1.78 . _(derived by Rule 1)_  
      - :Input :unitSystem "metric" . _(source)_  
      - :Input :weight 72 . _(source)_  
      - :Input :height 178 . _(source)_  
    - :Case :heightSquared 3.1684 . _(derived by Rule 3)_  
      - :Case :weightKg 72 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
      - :Case :heightM 1.78 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
    - :Case :bmiRounded 22.72 . _(derived by Rule 3)_  
      - :Case :weightKg 72 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
      - :Case :heightM 1.78 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
    - ... 2 more premise fact(s)  
  - :Reason :categoryRule "Normal" . _(derived by Rule 11)_  
    - :Case :weightKg 72 . _(derived by Rule 1)_  
      - :Input :unitSystem "metric" . _(source)_  
      - :Input :weight 72 . _(source)_  
      - :Input :height 178 . _(source)_  
    - :Case :heightM 1.78 . _(derived by Rule 1)_  
      - :Input :unitSystem "metric" . _(source)_  
      - :Input :weight 72 . _(source)_  
      - :Input :height 178 . _(source)_  
    - :Case :heightSquared 3.1684 . _(derived by Rule 3)_  
      - :Case :weightKg 72 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
      - :Case :heightM 1.78 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
    - :Case :bmiRounded 22.72 . _(derived by Rule 3)_  
      - :Case :weightKg 72 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
      - :Case :heightM 1.78 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
    - ... 2 more premise fact(s)  
  - :Reason :calculation "The normalized weight and height were used to compute BMI, then the result was mapped to the WHO adult category table." . _(derived by Rule 11)_  
    - :Case :weightKg 72 . _(derived by Rule 1)_  
      - :Input :unitSystem "metric" . _(source)_  
      - :Input :weight 72 . _(source)_  
      - :Input :height 178 . _(source)_  
    - :Case :heightM 1.78 . _(derived by Rule 1)_  
      - :Input :unitSystem "metric" . _(source)_  
      - :Input :weight 72 . _(source)_  
      - :Input :height 178 . _(source)_  
    - :Case :heightSquared 3.1684 . _(derived by Rule 3)_  
      - :Case :weightKg 72 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
      - :Case :heightM 1.78 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
    - :Case :bmiRounded 22.72 . _(derived by Rule 3)_  
      - :Case :weightKg 72 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
      - :Case :heightM 1.78 . _(derived by Rule 1)_  
        - :Input :unitSystem "metric" . _(source)_  
        - :Input :weight 72 . _(source)_  
        - :Input :height 178 . _(source)_  
    - ... 2 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://example.org/bmi#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:Case :weightKg 72 .  
:Case :heightM 1.78 .  
:Reason :units "Inputs were already metric, so kilograms stay kilograms and centimeters are divided by 100 to obtain meters." .  
:Case :heightSquared 3.1684 .  
:Case :bmi 22.7244034844085 .  
:Case :bmiRounded 22.72 .  
:Case :healthyMinKg 58.6154 .  
:Case :healthyMaxKg 78.89316 .  
:Case :healthyMinKgRounded 58.6 .  
:Case :healthyMaxKgRounded 78.9 .  
:Decision :category "Normal" .  
:Answer :bmi 22.72 .  
:Answer :category "Normal" .  
:Answer :healthyMinKg 58.6 .  
:Answer :healthyMaxKg 78.9 .  
:Answer :heightCm 178 .  
:Reason :formula "BMI is defined as weight in kilograms divided by height in meters squared." .  
:Reason :calculation "The normalized weight and height were used to compute BMI, then the result was mapped to the WHO adult category table." .  
:Reason :categoryRule "Normal" .  
:Reason :unitsExplanation "Inputs were already metric, so kilograms stay kilograms and centimeters are divided by 100 to obtain meters." .  
:report log:outputString "=== Answer ===\nBMI = 22.72\nCategory = Normal\nAt height 178 cm, a healthy-weight range is about 58.6–78.9 kg (BMI 18.5–24.9).\n\n=== Explanation ===\nBMI is defined as weight in kilograms divided by height in meters squared. This program first normalizes the input to SI units, computes BMI, and then applies WHO adult categories as half-open intervals. The healthy-weight band is the weight range at the same height that corresponds to BMI 18.5 through 24.9.\n\n" .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "bmi" .  
  in:run see:title "BMI — Body Mass Index example." .  
  in:run see:sourceFile "examples/n3/bmi.n3" .  
  in:run see:sourceSHA256 "c7163f49a56f4405350787563e15aee0975fabd71ca773a8b32077b19ef25d3c" .  
  in:run see:description "This example turns a familiar health calculation into a small, inspectable\nSEE example. It normalizes either metric or US inputs, computes BMI, assigns\na WHO adult category, and derives a healthy-range weight band for the given\nheight. The report explains the result and includes independent validations for\nboundary handling and category behavior.\nFor reproducibility and documentation only; not medical advice." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 3 .  
  in:run see:compiledRules 12 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 1 .  
  in:run see:compiledQueries 0 .  
}  
```  

