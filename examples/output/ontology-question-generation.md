# ontology-question-generation  

This example uses N3 rules to generate candidate competency questions from OWL/RDFS ontology patterns. The rules derive structured `q:CompetencyQuestion` resources and render this Markdown with `log:outputString`.  

## Source files  

- [N3 rules](../ontology-question-generation.n3)  
- [Input ontology TriG](../input/ontology-question-generation.trig)  

## Detected competency questions  

- **Class population** — Which things are instances of `employee`?  
- **Class population** — Which things are instances of `organization`?  
- **Class population** — Which things are instances of `person`?  
- **Class population** — Which things are instances of `project`?  
- **Subclass distinction** — What distinguishes `employee` from a general `person`?  
- **Object property** — For a given `employee`, which `project` is related by `assigned to`?  
- **Object property** — For a given `organization`, which `person` is related by `employs`?  
- **Object property** — For a given `person`, which `organization` is related by `works for`?  
- **Datatype property** — What is the `birth date` value of a given `person`?  
- **Datatype property** — What is the `legal name` value of a given `organization`?  
- **Existential restriction** — For each `employee`, which `organization` must exist via `works for`?  
- **Minimum cardinality** — Does every `employee` need at least `1` value for `assigned to`?  
- **Disjointness** — Can something ever be both an `organization` and a `person`?  
- **Functional property** — Can one subject have multiple values for `birth date`?  
- **Inverse property** — If `x` has `works for` `y`, should `y` have `employs` `x`?  
- **Subproperty** — When `principal employer` holds, should `works for` also hold?  

## RDF shape behind the Markdown  

Each rendered line is backed by a structured generated resource with a pattern, slots, an answer shape, and priority. That means a later layer can verbalize the same generated questions as Markdown, SPARQL skeletons, SHACL prompts, UI forms, or documentation checks.  
