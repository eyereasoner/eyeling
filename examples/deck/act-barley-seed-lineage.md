# ACT barley seed lineage — can and can't

This deck explains the example `act-barley-seed-lineage-can-and-cant.n3`.

The aim is to show how **Applied Constructor Theory** can describe a concrete biological case in Notation3 while doing both sides of Chiara Marletto’s formula:

- the **science of can**
- and the **science of can’t**

The example models a **barley seed lineage** and compares one viable lineage with several contrast lineages that are missing a crucial ingredient.

So the file does not only ask:

> What can a lineage do when the right structure is present?

It also asks:

> What can a lineage _not_ do when digital heredity, repair, protected dormancy, or heritable variation are missing?

That makes it a more explicitly constructor-theoretic example than the earlier `act-barley-seed-lineage.n3`, because impossibility is derived by rules rather than just mentioned informally.

---

## What “Applied Constructor Theory” means here

Constructor theory describes nature in terms of **tasks**:

- tasks that are **possible**,
- tasks that are **impossible**,
- and the physical reasons why.

In Marletto’s constructor theory of life, the key biological processes are not described first as trajectories or differential equations, but as transformations that can or cannot be carried out under suitable laws and resources.

That means questions like these become central:

- Can hereditary information be copied accurately?
- Can a system reproduce itself?
- Can a lineage survive through dormancy and then restart development?
- Can heritable variation occur?
- Can natural selection act on that variation?
- And just as importantly: **what cannot happen when key ingredients are absent?**

So in this example, “Applied Constructor Theory” means:

- taking a recognizable biological topic,
- expressing it as a network of possible and impossible tasks,
- and using N3 rules to derive those outcomes explicitly.

---

## The biological story in plain language

The file models four different barley-like lineages.

### 1. `:mainLine`

This is the viable lineage.

It has:

- a genome stored in a **digital hereditary medium**,
- a repair-capable embryo vehicle,
- a protective seed coat for dormancy,
- an adult stage that can produce propagules,
- a variation source,
- and a saline selection environment that favours its variant.

This lineage is the positive case.

### 2. `:analogLine`

This lineage looks similar, but its hereditary information is stored in a **non-digital medium**.

It is there to show that under no-design laws, accurate genome copying **cannot** be derived.

### 3. `:fragileLine`

This lineage uses a digital hereditary medium, but lacks **repair support**.

It is there to show that accurate self-reproduction is blocked if reliable damage correction is unavailable.

### 4. `:coatlessLine`

This lineage has digital heredity and repair, but no protected dormant compartment.

It is there to show that **protected dormancy** and therefore one form of **lineage closure** cannot be achieved.

### 5. `:staticLine`

This lineage has digital heredity, repair, and protected dormancy, but no heritable variation.

It is there to show that a lineage can reproduce and persist in some sense while still **failing to be evolvable**.

---

## The constructor-theoretic point of the example

The example is built around a simple but powerful pattern:

- when the right structural ingredients are present, a lineage **can** perform certain tasks;
- when one of those ingredients is missing, some tasks **cannot** be performed.

So the file is not saying:

> barley always does X.

It is saying:

> given these conditions, X is possible; given these missing ingredients, Y is impossible.

That distinction is exactly the constructor-theoretic style.

---

## Main entities in the file

Before looking at the rules, it helps to know what the main objects represent.

### The world assumption

```n3
:world :obeys :NoDesignLaws .
```

This is the background assumption shared by all lineages.

It says that the laws of nature are not secretly pre-loaded with biological design. The biological organization must therefore be explainable through the physical possibility of the relevant tasks.

### The hereditary media

There are two contrasting hereditary media:

- `:dnaRegister a :DigitalInformationMedium`
- `:analogRegister a :NonDigitalInformationMedium`

This contrast drives one of the strongest “can’t” conclusions in the file.

### The developmental bottleneck

```n3
:zygote a :DevelopmentalBottleneck .
```

This represents the narrow hereditary stage through which the lineage passes from generation to generation.

### The environments and shared resources

The file includes:

- a `:greenhouse` with warmth, moisture, and light,
- a `:nutrientBed` as a raw material supply,
- a `:pollinationLoop` for reproduction support,
- a `:mutationSource` for heritable variation,
- and a `:salineBench` as the selection environment.

These do not simulate chemistry in detail. They provide the structural conditions needed for the relevant tasks to be derived.

---

## The positive lineage: what `:mainLine` can do

The positive lineage contains all the key ingredients.

Its genome is a replicator stored digitally:

```n3
:mainGenome a :Replicator ;
  :accuracy :High ;
  :storedIn :dnaRegister ;
  :variant :SaltTolerant .
```

Its embryo vehicle supports metabolism, development, copying support, compartment control, and repair. Its adult vehicle supports metabolism, development, gamete production, and seed construction. Its seed has a protective seed coat. Its lineage is marked as having variation present.

That lets the file derive the following `:can` conclusions:

- genome copying under no-design laws
- protected dormancy
- germination
- propagule production
- accurate self-reproduction
- lineage closure
- heritable variation
- adaptive persistence
- evolvable lineage status

---

## The contrast lineages: what they can’t do

The four contrast lineages are not there as decoration. Each one is built to fail for a specific reason.

### `:analogLine`

The analog line stores hereditary information in a non-digital medium.

Its role is to show:

- no digital hereditary medium u2192 no accurate genome copying under no-design laws u2192 no accurate self-reproduction

### `:fragileLine`

The fragile line lacks repair.

Its role is to show:

- no reliable damage correction u2192 no accurate self-reproduction

### `:coatlessLine`

The coatless line lacks a protective dormant compartment.

Its role is to show:

- no protected dormancy u2192 no lineage closure through the protected seed stage

### `:staticLine`

The static line has no heritable variation.

Its role is to show:

- no adaptive evolution u2192 no adaptive persistence u2192 no evolvable lineage

This is especially useful because it separates **mere reproduction** from **evolvability**.

---

## What the rules are doing

This is the core of the example.

The rules are grouped into two large parts:

- **CAN rules**
- **CAN’T rules**

The first group derives possible tasks and positive lineage properties. The second group derives blocked tasks and impossible lineage properties.

---

## Part 1 — CAN rules

### Rule group 1: digital heredity makes genome copying possible

```n3
{ :world :obeys :NoDesignLaws .
  ?Genome a :Replicator ;
          :storedIn ?Medium .
  ?Medium a :DigitalInformationMedium . }
=>
{ ?Genome :can :GenomeCopyUnderNoDesignLaws . } .
```

This rule is the positive starting point.

It says:

- if the world obeys no-design laws,
- and a replicator is stored in a digital hereditary medium,
- then accurate genome copying is physically possible in principle.

This is the constructor-theory-of-life analogue of saying:

> digital hereditary information makes faithful replication physically available.

### Rule group 2: a seed coat makes protected dormancy possible

```n3
{ ?Seed a :Organism ;
        :lifeStage :DormantSeed ;
        :hasCompartment ?Compartment .
  ?Compartment :function :DormancyProtection . }
=>
{ ?Seed :can :ProtectedDormancy . } .
```

This rule converts a structural feature into a task capability.

It says that a dormant seed with a protective compartment can enter and sustain **protected dormancy**.

### Rule group 3: environmental support makes germination possible

```n3
{ ?Seed a :Organism ;
        :lifeStage :DormantSeed .
  :greenhouse :condition :WarmthAvailable .
  :greenhouse :condition :MoistureAvailable .
  :nutrientBed a :RawMaterialSupply . }
=>
{ ?Seed :can :Germinate . } .
```

This rule says the dormant seed can restart active development when the environment supplies the right enabling conditions.

### Rule group 4: the adult stage can generate propagules

```n3
{ ?Adult a :Organism ;
         :lifeStage :AdultPlant ;
         :hasVehicle ?Vehicle .
  ?Vehicle :function :GameteProduction .
  ?Vehicle :function :SeedConstruction .
  :pollinationLoop a :ReproductionSupport .
  :greenhouse :condition :LightAvailable . }
=>
{ ?Adult :can :PropaguleProduction . } .
```

This rule says the adult stage is reproductively productive.

It can create the next generation’s starting units.

### Rule group 5: accurate self-reproduction needs copying, repair, and a bottleneck

```n3
{ ?Line a :Lineage ;
        :seedStage ?Seed ;
        :replicator ?Genome .
  ?Genome :can :GenomeCopyUnderNoDesignLaws .
  ?Seed :hasVehicle ?Vehicle .
  ?Vehicle :usesRepair ?Repair .
  ?Repair a :RepairVehicle .
  :zygote a :DevelopmentalBottleneck . }
=>
{ ?Line :can :AccurateSelfReproduction . } .
```

This is one of the main biological rules.

It says accurate self-reproduction is not obtained from copying alone. It also needs:

- repair,
- and a developmental bottleneck.

So the rule captures a more realistic constructor-theory-of-life claim:

> accurate reproduction requires organized architecture, not just template duplication.

### Rule group 6: lineage closure needs the whole life-cycle loop

```n3
{ ?Line a :Lineage ;
        :seedStage ?Seed ;
        :adultStage ?Adult .
  ?Seed :can :ProtectedDormancy .
  ?Seed :can :Germinate .
  ?Adult :can :PropaguleProduction . }
=>
{ ?Line :can :LineageClosure . } .
```

This rule says the lineage can close its life cycle only if the key stages connect:

- the seed can survive,
- the seed can restart,
- and the adult can produce new seeds.

### Rule group 7: variation enables evolvable behavior

```n3
{ ?Line a :Lineage ;
        :variationStatus :Present . }
=>
{ ?Line :can :HeritableVariation . } .
```

This rule is deliberately simple. It marks the lineage as one in which heritable variation is possible.

### Rule group 8: adaptive persistence needs both reproduction and variation

```n3
{ ?Line a :Lineage ;
        :variant ?Variant .
  ?Line :can :AccurateSelfReproduction .
  ?Line :can :HeritableVariation .
  :salineBench :favours ?Variant . }
=>
{ ?Line :can :AdaptivePersistence . } .
```

This rule joins three ideas:

- reliable reproduction,
- heritable variation,
- and environmental selection.

That is what turns a merely surviving line into an adaptively persistent one.

### Rule group 9: evolvability is a higher-level outcome

```n3
{ ?Line :can :LineageClosure .
  ?Line :can :AdaptivePersistence . }
=>
{ ?Line a :EvolvableLineage . } .
```

This final positive rule says that evolvability is a composite property. It is not assumed. It is derived from lower-level task capabilities.

---

## Part 2 — CAN’T rules

Now the file does something especially constructor-theoretic: it derives impossibility claims explicitly.

### Rule group 10: non-digital heredity blocks accurate copying under no-design laws

```n3
{ :world :obeys :NoDesignLaws .
  ?Genome a :Replicator ;
          :storedIn ?Medium .
  ?Medium a :NonDigitalInformationMedium . }
=>
{ ?Genome :cannot :AccurateGenomeCopyUnderNoDesignLaws . } .
```

This is the negative mirror of the first positive rule.

It says that when the hereditary medium is not digital, accurate genome copying under no-design laws is not available.

This is the key reason `:analogLine` fails.

### Rule group 11: if accurate copying is blocked, accurate self-reproduction is blocked

```n3
{ ?Line :replicator ?Genome .
  ?Genome :cannot :AccurateGenomeCopyUnderNoDesignLaws . }
=>
{ ?Line :cannot :AccurateSelfReproduction . } .
```

This rule propagates the impossibility from the genome level to the lineage level.

### Rule group 12: no repair means no reliable damage correction

```n3
{ ?Line a :Lineage ;
        :lacksRepair true . }
=>
{ ?Line :cannot :ReliableDamageCorrection . } .
```

This rule is used for `:fragileLine`. It says that the absence of repair is not a minor defect; it blocks a crucial task.

### Rule group 13: no damage correction means no accurate self-reproduction

```n3
{ ?Line :cannot :ReliableDamageCorrection . }
=>
{ ?Line :cannot :AccurateSelfReproduction . } .
```

This rule turns that missing subsystem into a biological impossibility claim.

### Rule group 14: no seed protection means no protected dormancy

```n3
{ ?Line a :Lineage ;
        :lacksDormancyProtection true . }
=>
{ ?Line :cannot :ProtectedDormancy . } .
```

This is the core negative rule for `:coatlessLine`.

### Rule group 15: no protected dormancy blocks lineage closure

```n3
{ ?Line :cannot :ProtectedDormancy . }
=>
{ ?Line :cannot :LineageClosure . } .
```

This rule is important because it shows how one missing capability can break a larger life-cycle property.

### Rule group 16: no heritable variation blocks adaptive evolution

```n3
{ ?Line a :Lineage ;
        :variationStatus :None . }
=>
{ ?Line :cannot :AdaptiveEvolution . } .
```

This is the key negative rule for `:staticLine`.

It says that even if reproduction works, the lineage still cannot count as adaptively evolving without heritable variation.

### Rule group 17: if adaptive evolution is blocked, adaptive persistence is blocked

```n3
{ ?Line :cannot :AdaptiveEvolution . }
=>
{ ?Line :cannot :AdaptivePersistence . } .
```

This rule pushes the impossibility upward to a broader lineage property.

### Rule group 18: blocked reproduction, persistence, or closure blocks evolvability

```n3
{ ?Line :cannot :AccurateSelfReproduction . }
=>
{ ?Line :cannot :EvolvableLineage . } .

{ ?Line :cannot :AdaptivePersistence . }
=>
{ ?Line :cannot :EvolvableLineage . } .

{ ?Line :cannot :LineageClosure . }
=>
{ ?Line :cannot :EvolvableLineage . } .
```

These are the final negative rules.

They say that evolvability is fragile in a structured way. If any of the major task clusters fail, the lineage cannot count as evolvable.

---

## What the checks are proving

The check section is divided into two halves.

### Positive checks

These confirm that the viable lineage really does derive the intended positive conclusions:

- genome copying under no-design laws
- protected dormancy
- germination
- propagule production
- accurate self-reproduction
- lineage closure
- heritable variation
- adaptive persistence
- evolvable lineage status

### Negative checks

These confirm that the contrast lineages derive the intended impossibility results:

- `:analogLine` cannot achieve accurate self-reproduction
- `:fragileLine` cannot achieve accurate self-reproduction
- `:coatlessLine` cannot achieve lineage closure
- `:staticLine` cannot achieve adaptive evolution
- `:staticLine` cannot be an evolvable lineage

So the ARC output is not just a narrative summary. It is backed by explicit derivations of both possible and impossible outcomes.

---

## Why this example is stronger than the earlier barley case

The earlier barley example focused mainly on the **can** side:

- what tasks become possible,
- and how those tasks accumulate into self-reproduction and evolvability.

This version keeps that structure, but adds a second layer:

- contrasting lineages,
- explicit `:cannot` derivations,
- and causal explanations of failure.

That makes it more faithful to the slogan **“the science of can and can’t.”**

It also makes the biological reasoning more informative. Instead of only learning that the main lineage succeeds, we learn _why the others fail_.

---

## The key lesson

The file’s main lesson is this:

> Constructor theory of life is not just about describing successful life-like systems. It is also about identifying which life-like tasks become impossible when specific structural ingredients are absent.

In this example:

- digital hereditary information matters,
- repair matters,
- protected dormancy matters,
- and heritable variation matters.

Each missing ingredient removes a capability. And those lost capabilities propagate upward into lost lineage-level properties.

That is exactly the kind of explanation constructor theory is good at:

- not just what happens,
- but what can happen,
- what cannot happen,
- and why.
