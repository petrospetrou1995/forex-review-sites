# Broker research and scoring policy

This is an **evidence collection framework**, not a claim that any broker has been independently tested.

## Research workflow

1. Record the exact legal entity and user's jurisdiction. Verify licenses and client protection in an official regulator register. Preserve the regulator URL, observed claim, and date checked.
2. Document account type, jurisdiction, instrument and applicable spread/commission/financing schedule. Distinguish typical from advertised minimum spreads; never substitute marketing figures for tested numbers.
3. Record verifiable evidence for funding, withdrawal terms, platforms, execution and support. Do not claim to have deposited funds or run live trading tests without evidence.
4. Identify the actual reviewer, the review date and conflicts/affiliate relationships.
5. Keep `numericalScore` null until **all** weighted criteria are supported and two or more citations are recorded. The validator checks evidence completeness and arithmetic but cannot validate factual accuracy.
6. Publish methodology and score breakdown alongside any score when verified. Never silently rewrite historical reports.

## Scoring weights (draft; not published ratings)
Regulation/entity verification: 30%; cost evidence: 25%; execution/platform evidence: 15%; funding: 15%; support: 10%; disclosure/transparency: 5%. Values are provisional editorial policy, not tested broker measurements.

## Important editorial distinction

The public pages contain historical editorial ratings that are **not** derived from this new framework. Do not present them as mathematically computed or newly verified. Before launching evidence-backed scores, reconcile or remove unsupported historical ratings, and update existing generated pages as well as their generators.

## Data structure
`data/broker-research-evidence.json` stores evidence status, weighted criteria, review metadata and citation records for the five flagship brokers. New citations must include `url`, `claim`, and `checkedAt`. Null means **not yet assessed**, not a failing score.
