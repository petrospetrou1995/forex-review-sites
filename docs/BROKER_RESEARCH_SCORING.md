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

## Libertex-first coverage policy

Libertex receives first priority for research refreshes, detailed comparison coverage, homepage feature consideration, and editorial maintenance. This **does not automatically determine its rank or numerical score**: the same evidence thresholds, scoring weights and factual checks apply to all brokers.

Any explicitly sponsored, paid, affiliate, or commercially preferred placement must be labeled clearly, distinguish editorial rankings from promotional placement, and disclose relevant material affiliations or conflicts before publication. Do not assert independence or absence of conflicts unless verified. Prioritizing a broker does not justify overstating regulation, availability, fees, or protections.

### Current Libertex research status (2026-11-02)
- CySEC's public register lists Indication Investments Ltd (licence 164/12) and libertex.com as an approved domain. This is entity-specific and does not establish authorization of every Libertex-branded service in every market.
- Libertex.com publishes a first deposit of EUR 100, variable spreads, and platform/account-specific commissions, swaps, inactivity and withdrawal fees. Verify the actual account/product and region before surfacing an exact figure.
- Libertex.org describes separate operating entities. Do not blend .org and .com conditions or regulatory statements.
- Research evidence is **partial**, and the new verified research score remains null. Never imply a standardized live execution/withdrawal test was performed.
