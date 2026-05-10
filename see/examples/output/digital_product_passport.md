# Digital Product Passport  

## Conclusion  
Passport decision : PASS for ACME X1000 SN123.  
recycled content : 13%  
lifecycle footprint : 52500 gCO2e  
total component mass : 105 g  
critical raw materials : Lithium, Cobalt  
circularity hint : repairFriendly  
public endpoint : https://example.org/dpp/ACME-X1000-SN123  

## Explanation  
The passport folds the explicit component list to derive total mass and recycled mass, then computes an integer recycled-content percentage. Lifecycle footprint is derived by summing manufacturing, transport, and use-phase emissions. The product is repair-friendly because the battery is replaceable and the public passport section exposes repair, spare-parts, and manual documentation. Restricted declarations remain in the restricted section.  

Component roll-up:  
BatteryPack-01 Battery mass=48g recycled=0g materials=Lithium, Cobalt, Nickel replaceable=yes  
Chassis-01 Housing mass=32g recycled=12g materials=Aluminium replaceable=no  
Mainboard-01 Electronics mass=25g recycled=2g materials=Copper, GoldTrace replaceable=no  
Public documents:  
Doc-UserManual UserManual https://example.org/manuals/acme-x1000  
Doc-RepairGuide RepairGuide https://example.org/repair/acme-x1000  
Doc-SpareParts SparePartsCatalog https://example.org/spares/acme-x1000  

**Generated derivation support**  

Compiled support: 90 source fact(s), 12 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (3 premise pattern(s) => 1 conclusion pattern(s)) derives :passport :exposesCriticalMaterial :Lithium ., :passport :exposesCriticalMaterial :Cobalt .  
  - Uses: :ACME_X1000_SN123 :hasComponent :BatteryPack_01 . _(source)_; :BatteryPack_01 :containsMaterial :Lithium . _(source)_; :Lithium :criticalRawMaterial true . _(source)_; :BatteryPack_01 :containsMaterial :Cobalt . _(source)_; … +1 more premise fact(s)  
- Rule 2 (3 premise pattern(s) => 2 conclusion pattern(s)) derives :MassRollup :componentMass 48 ., :MassRollup :componentRecycledMass 0 ., :MassRollup :componentMass 32 ., :MassRollup :componentRecycledMass 12 ., … +2 more  
  - Uses: :ACME_X1000_SN123 :hasComponent :BatteryPack_01 . _(source)_; :BatteryPack_01 :massG 48 . _(source)_; :BatteryPack_01 :recycledMassG 0 . _(source)_; :ACME_X1000_SN123 :hasComponent :Chassis_01 . _(source)_; … +5 more premise fact(s)  
- Rule 3 (4 premise pattern(s) => 3 conclusion pattern(s)) derives :passport :totalMassG 105 ., :passport :recycledMassG 14 ., :passport :recycledPct 13 .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  
- Rule 4 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :passport :lifecycleFootprintGCO2e 52500 .  
  - Uses: :Footprint :manufacturingGCO2e 32000 . _(source)_; :Footprint :transportGCO2e 2500 . _(source)_; :Footprint :usePhaseGCO2e 18000 . _(source)_  
- Rule 5 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :passport :hasRequiredPublicDocType :UserManual ., :passport :hasRequiredPublicDocType :RepairGuide ., :passport :hasRequiredPublicDocType :SparePartsCatalog .  
  - Uses: :Policy :publicDocType :UserManual . _(source)_; :Doc_UserManual rdf:type :Document . _(source)_; :Doc_UserManual :docType :UserManual . _(source)_; :Doc_UserManual :section "public" . _(source)_; … +8 more premise fact(s)  
- Rule 6 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :passport :keepsRestrictedDocTypeRestricted :DeclarationOfConformity ., :passport :keepsRestrictedDocTypeRestricted :SubstanceDeclaration .  
  - Uses: :Policy :restrictedDocType :DeclarationOfConformity . _(source)_; :Doc_DoC_CE rdf:type :Document . _(source)_; :Doc_DoC_CE :docType :DeclarationOfConformity . _(source)_; :Doc_DoC_CE :section "restricted" . _(source)_; … +4 more premise fact(s)  

Selected explanation support:  
  - :digitalProductPassport :decision "PASS" . _(derived by Rule 14)_  
    - :passport :decision "PASS" . _(derived by Rule 11)_  
      - :passport :massBalanced true . _(derived by Rule 10)_  
        - :passport :totalMassG 105 . _(derived by Rule 3)_  
          - no graph premises; built-ins/constants satisfied the rule.  
        - :passport :recycledMassG 14 . _(derived by Rule 3)_  
          - no graph premises; built-ins/constants satisfied the rule.  
      - :passport :recycledPct 13 . _(derived by Rule 3)_  
        - no graph premises; built-ins/constants satisfied the rule.  
      - :passport :lifecycleFootprintGCO2e 52500 . _(derived by Rule 4)_  
        - :Footprint :manufacturingGCO2e 32000 . _(source)_  
        - :Footprint :transportGCO2e 2500 . _(source)_  
        - :Footprint :usePhaseGCO2e 18000 . _(source)_  
      - :passport :exposesCriticalMaterial :Lithium . _(derived by Rule 1)_  
        - :ACME_X1000_SN123 :hasComponent :BatteryPack_01 . _(source)_  
        - :BatteryPack_01 :containsMaterial :Lithium . _(source)_  
        - :Lithium :criticalRawMaterial true . _(source)_  
      - ... 9 more premise fact(s)  
    - :passport :totalMassG 105 . _(derived by Rule 3)_  
      - no graph premises; built-ins/constants satisfied the rule.  
    - :passport :recycledPct 13 . _(derived by Rule 3)_  
      - no graph premises; built-ins/constants satisfied the rule.  
    - :passport :lifecycleFootprintGCO2e 52500 . _(derived by Rule 4)_  
      - :Footprint :manufacturingGCO2e 32000 . _(source)_  
      - :Footprint :transportGCO2e 2500 . _(source)_  
      - :Footprint :usePhaseGCO2e 18000 . _(source)_  
    - ... 3 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/digital-product-passport#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix list: <http://www.w3.org/2000/10/swap/list#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:digitalProductPassport :decision "PASS" .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "digital_product_passport" .  
  in:run see:title "Digital Product Passport" .  
  in:run see:sourceFile "examples/n3/digital_product_passport.n3" .  
  in:run see:sourceSHA256 "502e99d8e51a930eba50cb2411263cb6db5d98d63fe3dd48254612d993a9ab95" .  
  in:run see:description "N3-compiled version of the smartphone Digital Product Passport example. The\nrules fold component mass, recycled content, critical raw materials, public\ndocuments, lifecycle footprint, and access-policy validations into a public PASS." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 90 .  
  in:run see:compiledRules 12 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 2 .  
  in:run see:compiledQueries 1 .  
}  
```  

