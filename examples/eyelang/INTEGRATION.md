# Eyelang examples inside Eyeling

This directory contains eyelang examples that can be exercised through Eyeling's experimental second engine:

```bash
eyeling --engine eyelang examples/eyelang/ancestor.pl
```

For a paired example, compare the N3 and eyelang versions of the same dependency-risk scenario:

```bash
eyeling examples/vulnerability-impact.n3
eyeling --engine eyelang examples/eyelang/vulnerability-impact.pl
```

The eyelang conformance corpus is kept under `test/eyelang/` and can be run with:

```bash
npm run test:eyelang:corpus
```
