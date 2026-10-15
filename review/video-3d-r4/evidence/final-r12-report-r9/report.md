# R12 source-bound evidence snapshot

Captured 2026-10-15T16:15:07.241Z to 2026-10-15T16:15:23.849Z; label: 1615-cutoff-observation.

Partial evidence remains partial. All40 cases are visible. No recovered timing, missing-status inference, or acceptance claim.

4-core CPU quota; SwiftShader software GPU; overlapping local jobs. Phone/desktop are viewport profiles, not physical-device measurements.

Source commit `64ec9ad5b7a90b590b289f6a02f0bbd50138db08`; served source `6d362ff52101541719cc6b639d48b394630113fa61b3467ddbecb78dbe8742b8`; protocol `bf94e388a2d71f1d3f7c75dd5d1855a4d69ddd8ba946dc81905faa85746e57ad`.
Baseline `7c714d23fd839129b6abbf718460cd7bf5bad59c34988292a26e4c5046aa05e6`; paired `b9cf187314d545233fda59b861bb8dfb7eeacdb722a7064a38e4442281984524`; unpaired `67c313c67a131763572e3bcb4a07beec85a683063e3f9766ef1fec8d7de12319`.

Recorded main 40/40; strict paired-master 18/40; raw attempts 40, recorded 40, unpaired recorded 22.

## Strict gates

Unchanged compareRuns complete: **false**. Incomplete coverage means **UNPROVEN**, regardless of partial-pair medians. RSS is recorded, not an acceptance gate.

| Profile | Paired measurable | Quality gate | Phone/desktop noSlower | SSIM median gain (partial pairs only if incomplete) | Laplacian median ratio (same scope) |
|---|---:|---|---|---:|---:|
| phone | 11 | false | false | 0.1033638690718226 | 4.757726143168869 |
| desktop | 0 | false | false | — | — |

Quality thresholds are +0.03 SSIM and1.5× Laplacian with full accounted cohort; phone timing median and worst must not regress. The comparator JSON is preserved unchanged; desktop timing is diagnostic. No partial median is presented as a completed-corpus median.

## All20 clips × both profiles: original strict outcomes

First3D/bake values are original recorded seconds; RSS is MiB; sharpness is Laplacian variance. Incomplete-row values do not recover successful timing. Missing rows stay missing.

| Clip | Profile | Version | Original outcome | First3D s | Bake s | RSS MiB | SSIM | Sharpness | Original reason / copied raw evidence |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| cat-track | phone | main | explained | — | 39.325 | 1152.75 | — | — | Phase: bake; full original reason retained [raw](evidence/main/cat-track-phone/result.json.gz) |
| cat-track | phone | R12 strict paired | harness-error | 99.503 | 615.021 | 1597.91 | — | — | Phase: evaluation; full original reason retained [raw](evidence/paired-master/cat-track-phone/result.json.gz) |
| cat-track | desktop | main | timeout | — | 1748.384 | 1845.10 | — | — | Phase: bake; full original reason retained [raw](evidence/main/cat-track-desktop/result.json.gz) |
| cat-track | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| cat-plays | phone | main | finished | 69.634 | 875.780 | 1401.08 | 0.3128355397132256 | 0.00006922760172753247 | Phase: evaluation; full original reason retained [raw](evidence/main/cat-plays-phone/result.json.gz) |
| cat-plays | phone | R12 strict paired | explained | — | 107.505 | 1056.95 | — | — | Phase: bake; full original reason retained [raw](evidence/paired-master/cat-plays-phone/result.json.gz) |
| cat-plays | desktop | main | explained | — | 1023.871 | 1314.93 | — | — | Phase: bake; full original reason retained [raw](evidence/main/cat-plays-desktop/result.json.gz) |
| cat-plays | desktop | R12 strict paired | explained | — | 421.302 | 1290.23 | — | — | Phase: bake; full original reason retained [raw](evidence/paired-master/cat-plays-desktop/result.json.gz) |
| buddha | phone | main | explained | — | 82.157 | 1141.52 | — | — | Phase: bake; full original reason retained [raw](evidence/main/buddha-phone/result.json.gz) |
| buddha | phone | R12 strict paired | explained | — | 133.697 | 1089.38 | — | — | Phase: bake; full original reason retained [raw](evidence/paired-master/buddha-phone/result.json.gz) |
| buddha | desktop | main | timeout | — | 1680.902 | 1754.50 | — | — | Phase: bake; full original reason retained [raw](evidence/main/buddha-desktop/result.json.gz) |
| buddha | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| chameleon-flowers | phone | main | finished | 97.407 | 693.968 | 1381.65 | 0.6687733199606671 | 0.000028175948485074986 | Phase: evaluation; full original reason retained [raw](evidence/main/chameleon-flowers-phone/result.json.gz) |
| chameleon-flowers | phone | R12 strict paired | finished | 118.816 | 604.993 | 1625.33 | 0.6356316191568732 | 0.0003958726771877761 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/chameleon-flowers-phone/result.json.gz) |
| chameleon-flowers | desktop | main | timeout | — | 1737.330 | 2046.25 | — | — | Phase: bake; full original reason retained [raw](evidence/main/chameleon-flowers-desktop/result.json.gz) |
| chameleon-flowers | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| dianthus | phone | main | finished | 110.304 | 1260.167 | 1322.46 | 0.27008633062524745 | 0.0005881391248470482 | Phase: evaluation; full original reason retained [raw](evidence/main/dianthus-phone/result.json.gz) |
| dianthus | phone | R12 strict paired | finished | 105.634 | 591.326 | 1644.28 | 0.4281062815288338 | 0.0030940348245014626 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/dianthus-phone/result.json.gz) |
| dianthus | desktop | main | timeout | — | 1759.269 | 1903.04 | — | — | Phase: bake; full original reason retained [raw](evidence/main/dianthus-desktop/result.json.gz) |
| dianthus | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| pisac | phone | main | harness-error | 124.718 | 1737.688 | 1351.04 | — | — | Phase: evaluation; full original reason retained [raw](evidence/main/pisac-phone/result.json.gz) |
| pisac | phone | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| pisac | desktop | main | timeout | — | 1754.471 | 1722.37 | — | — | Phase: bake; full original reason retained [raw](evidence/main/pisac-desktop/result.json.gz) |
| pisac | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| sleeping-dog | phone | main | explained | — | 209.120 | 1101.05 | — | — | Phase: bake; full original reason retained [raw](evidence/main/sleeping-dog-phone/result.json.gz) |
| sleeping-dog | phone | R12 strict paired | explained | — | 76.801 | 1077.35 | — | — | Phase: bake; full original reason retained [raw](evidence/paired-master/sleeping-dog-phone/result.json.gz) |
| sleeping-dog | desktop | main | timeout | — | 1750.532 | 1462.05 | — | — | Phase: bake; full original reason retained [raw](evidence/main/sleeping-dog-desktop/result.json.gz) |
| sleeping-dog | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| palace-statue | phone | main | timeout | 211.882 | 1756.978 | 1309.21 | — | — | Phase: bake; full original reason retained [raw](evidence/main/palace-statue-phone/result.json.gz) |
| palace-statue | phone | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| palace-statue | desktop | main | timeout | — | 1736.262 | 1598.21 | — | — | Phase: bake; full original reason retained [raw](evidence/main/palace-statue-desktop/result.json.gz) |
| palace-statue | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| oa-street | phone | main | explained | — | 140.819 | 1078.50 | — | — | Phase: bake; full original reason retained [raw](evidence/main/oa-street-phone/result.json.gz) |
| oa-street | phone | R12 strict paired | explained | — | 136.160 | 1070.22 | — | — | Phase: bake; full original reason retained [raw](evidence/paired-master/oa-street-phone/result.json.gz) |
| oa-street | desktop | main | timeout | — | 1759.696 | 2058.90 | — | — | Phase: bake; full original reason retained [raw](evidence/main/oa-street-desktop/result.json.gz) |
| oa-street | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| ullard | phone | main | finished | 182.005 | 1335.907 | 1364.23 | 0.45703530353400834 | 0.00007838884891662116 | Phase: evaluation; full original reason retained [raw](evidence/main/ullard-phone/result.json.gz) |
| ullard | phone | R12 strict paired | finished | 95.883 | 583.380 | 1630.23 | 0.470764193311514 | 0.00042324159804453396 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/ullard-phone/result.json.gz) |
| ullard | desktop | main | timeout | — | 1746.379 | 1858.47 | — | — | Phase: bake; full original reason retained [raw](evidence/main/ullard-desktop/result.json.gz) |
| ullard | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| snaefell | phone | main | finished | 187.985 | 1144.385 | 1393.98 | 0.6376776922154899 | 0.00007302644740092879 | Phase: evaluation; full original reason retained [raw](evidence/main/snaefell-phone/result.json.gz) |
| snaefell | phone | R12 strict paired | finished | 188.083 | 677.088 | 1662.04 | 0.6400126887255453 | 0.0002786230262963258 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/snaefell-phone/result.json.gz) |
| snaefell | desktop | main | timeout | — | 1741.900 | 1526.94 | — | — | Phase: bake; full original reason retained [raw](evidence/main/snaefell-desktop/result.json.gz) |
| snaefell | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| fremantle-orbit | phone | main | finished | 194.430 | 1329.096 | 1335.53 | 0.7166192920695181 | 0.000027169038886368298 | Phase: evaluation; full original reason retained [raw](evidence/main/fremantle-orbit-phone/result.json.gz) |
| fremantle-orbit | phone | R12 strict paired | finished | 108.799 | 591.437 | 1576.25 | 0.6398566371825318 | 0.000022868804229690044 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/fremantle-orbit-phone/result.json.gz) |
| fremantle-orbit | desktop | main | timeout | — | 1752.550 | 2078.09 | — | — | Phase: bake; full original reason retained [raw](evidence/main/fremantle-orbit-desktop/result.json.gz) |
| fremantle-orbit | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| ihasalu-orbit | phone | main | finished | 163.672 | 1358.260 | 1321.68 | 0.48303946344612697 | 0.000257754262315883 | Phase: evaluation; full original reason retained [raw](evidence/main/ihasalu-orbit-phone/result.json.gz) |
| ihasalu-orbit | phone | R12 strict paired | finished | 100.580 | 591.840 | 1612.71 | 0.6302147495533457 | 0.0001979302229957984 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/ihasalu-orbit-phone/result.json.gz) |
| ihasalu-orbit | desktop | main | timeout | — | 1761.544 | 1989.77 | — | — | Phase: bake; full original reason retained [raw](evidence/main/ihasalu-orbit-desktop/result.json.gz) |
| ihasalu-orbit | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| fresnel-lens | phone | main | finished | 129.774 | 1440.804 | 1337.05 | 0.6554922928239859 | 0.00003040720026208701 | Phase: evaluation; full original reason retained [raw](evidence/main/fresnel-lens-phone/result.json.gz) |
| fresnel-lens | phone | R12 strict paired | finished | 136.892 | 628.351 | 1565.06 | 0.6962148736481286 | 0.000025261016756533563 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/fresnel-lens-phone/result.json.gz) |
| fresnel-lens | desktop | main | timeout | — | 1755.123 | 1737.03 | — | — | Phase: bake; full original reason retained [raw](evidence/main/fresnel-lens-desktop/result.json.gz) |
| fresnel-lens | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| saint-denis | phone | main | finished | 216.691 | 1374.855 | 1354.37 | 0.2542876716345405 | 0.0007005905940201272 | Phase: evaluation; full original reason retained [raw](evidence/main/saint-denis-phone/result.json.gz) |
| saint-denis | phone | R12 strict paired | finished | 158.546 | 642.900 | 1617.28 | 0.2752636584479978 | 0.0038276362670470344 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/saint-denis-phone/result.json.gz) |
| saint-denis | desktop | main | timeout | — | 1757.998 | 2074.85 | — | — | Phase: bake; full original reason retained [raw](evidence/main/saint-denis-desktop/result.json.gz) |
| saint-denis | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| horse-statue | phone | main | explained | — | 106.749 | 1082.69 | — | — | Phase: bake; full original reason retained [raw](evidence/main/horse-statue-phone/result.json.gz) |
| horse-statue | phone | R12 strict paired | harness-error | 102.854 | 590.628 | 1626.91 | — | — | Phase: evaluation; full original reason retained [raw](evidence/paired-master/horse-statue-phone/result.json.gz) |
| horse-statue | desktop | main | timeout | — | 1782.967 | 1742.20 | — | — | Phase: bake; full original reason retained [raw](evidence/main/horse-statue-desktop/result.json.gz) |
| horse-statue | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| royal-sovereign | phone | main | finished | 92.647 | 1479.863 | 1350.70 | 0.600749953909052 | 0.00017112742364729284 | Phase: evaluation; full original reason retained [raw](evidence/main/royal-sovereign-phone/result.json.gz) |
| royal-sovereign | phone | R12 strict paired | finished | 87.609 | 576.949 | 1641.13 | 0.762026429334955 | 0.00037295267582352314 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/royal-sovereign-phone/result.json.gz) |
| royal-sovereign | desktop | main | timeout | — | 1757.330 | 2145.58 | — | — | Phase: bake; full original reason retained [raw](evidence/main/royal-sovereign-desktop/result.json.gz) |
| royal-sovereign | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| viljandi-ruins | phone | main | finished | 185.808 | 1685.017 | 1325.27 | 0.5322677500850506 | 0.00004482823865469122 | Phase: evaluation; full original reason retained [raw](evidence/main/viljandi-ruins-phone/result.json.gz) |
| viljandi-ruins | phone | R12 strict paired | finished | 79.469 | 581.053 | 1636.61 | 0.6478765740500313 | 0.0004604788840906804 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/viljandi-ruins-phone/result.json.gz) |
| viljandi-ruins | desktop | main | timeout | — | 1760.630 | 2111.14 | — | — | Phase: bake; full original reason retained [raw](evidence/main/viljandi-ruins-desktop/result.json.gz) |
| viljandi-ruins | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| kakerdi-bog | phone | main | finished | 176.250 | 1523.138 | 1334.08 | 0.34732176752057164 | 0.00030550911643080145 | Phase: evaluation; full original reason retained [raw](evidence/main/kakerdi-bog-phone/result.json.gz) |
| kakerdi-bog | phone | R12 strict paired | finished | 84.914 | 575.053 | 1595.86 | 0.5896300690497417 | 0.00015227734541159625 | Phase: evaluation; full original reason retained [raw](evidence/paired-master/kakerdi-bog-phone/result.json.gz) |
| kakerdi-bog | desktop | main | timeout | — | 1762.280 | 1978.36 | — | — | Phase: bake; full original reason retained [raw](evidence/main/kakerdi-bog-desktop/result.json.gz) |
| kakerdi-bog | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| fjoloy | phone | main | harness-error | — | 103.402 | 1040.81 | — | — | Phase: bake; full original reason retained [raw](evidence/main/fjoloy-phone/result.json.gz) |
| fjoloy | phone | R12 strict paired | missing | — | — | — | — | — | No recorded native row |
| fjoloy | desktop | main | timeout | — | 1766.792 | 1883.80 | — | — | Phase: bake; full original reason retained [raw](evidence/main/fjoloy-desktop/result.json.gz) |
| fjoloy | desktop | R12 strict paired | missing | — | — | — | — | — | No recorded native row |

## Every raw R12 attempt, kept outside strict comparison

Rows completed after the captured master may appear here only. An unpaired success cannot enter strict quality comparison. Captured controller state and original row status are preserved separately in JSON.

| Clip | Profile | Mode / shard | Original outcome | First3D s | Bake s | RSS MiB | SSIM | Sharpness | Original reason / copied raw evidence |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| cat-track | phone | paired / 001-cat-track-phone-paired | harness-error | 99.503 | 615.021 | 1597.91 | — | — | Phase: evaluation; full original reason retained [raw](evidence/raw/001-cat-track-phone-paired/cat-track-phone/result.json.gz) |
| cat-plays | phone | paired / 002-cat-plays-phone-paired | explained | — | 107.505 | 1056.95 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/002-cat-plays-phone-paired/cat-plays-phone/result.json.gz) |
| buddha | phone | paired / 003-buddha-phone-paired | explained | — | 133.697 | 1089.38 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/003-buddha-phone-paired/buddha-phone/result.json.gz) |
| cat-plays | desktop | paired / 004-cat-plays-desktop-paired | explained | — | 421.302 | 1290.23 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/004-cat-plays-desktop-paired/cat-plays-desktop/result.json.gz) |
| chameleon-flowers | phone | paired / 005-chameleon-flowers-phone-paired | finished | 118.816 | 604.993 | 1625.33 | 0.6356316191568732 | 0.0003958726771877761 | Phase: evaluation; full original reason retained [raw](evidence/raw/005-chameleon-flowers-phone-paired/chameleon-flowers-phone/result.json.gz) |
| cat-track | desktop | unpaired / 006-cat-track-desktop-unpaired | explained | — | 415.708 | 1501.55 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/006-cat-track-desktop-unpaired/cat-track-desktop/result.json.gz) |
| dianthus | phone | paired / 007-dianthus-phone-paired | finished | 105.634 | 591.326 | 1644.28 | 0.4281062815288338 | 0.0030940348245014626 | Phase: evaluation; full original reason retained [raw](evidence/raw/007-dianthus-phone-paired/dianthus-phone/result.json.gz) |
| buddha | desktop | unpaired / 008-buddha-desktop-unpaired | explained | — | 433.174 | 1319.24 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/008-buddha-desktop-unpaired/buddha-desktop/result.json.gz) |
| chameleon-flowers | desktop | unpaired / 009-chameleon-flowers-desktop-unpaired | explained | — | 420.707 | 1464.70 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/009-chameleon-flowers-desktop-unpaired/chameleon-flowers-desktop/result.json.gz) |
| sleeping-dog | phone | paired / 010-sleeping-dog-phone-paired | explained | — | 76.801 | 1077.35 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/010-sleeping-dog-phone-paired/sleeping-dog-phone/result.json.gz) |
| oa-street | phone | paired / 011-oa-street-phone-paired | explained | — | 136.160 | 1070.22 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/011-oa-street-phone-paired/oa-street-phone/result.json.gz) |
| ullard | phone | paired / 012-ullard-phone-paired | finished | 95.883 | 583.380 | 1630.23 | 0.470764193311514 | 0.00042324159804453396 | Phase: evaluation; full original reason retained [raw](evidence/raw/012-ullard-phone-paired/ullard-phone/result.json.gz) |
| dianthus | desktop | unpaired / 013-dianthus-desktop-unpaired | explained | — | 24.320 | 1160.32 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/013-dianthus-desktop-unpaired/dianthus-desktop/result.json.gz) |
| pisac | desktop | unpaired / 014-pisac-desktop-unpaired | harness-error | 176.591 | 1113.539 | 1550.15 | — | — | Phase: evaluation; full original reason retained [raw](evidence/raw/014-pisac-desktop-unpaired/pisac-desktop/result.json.gz) |
| snaefell | phone | paired / 015-snaefell-phone-paired | finished | 188.083 | 677.088 | 1662.04 | 0.6400126887255453 | 0.0002786230262963258 | Phase: evaluation; full original reason retained [raw](evidence/raw/015-snaefell-phone-paired/snaefell-phone/result.json.gz) |
| fremantle-orbit | phone | paired / 016-fremantle-orbit-phone-paired | finished | 108.799 | 591.437 | 1576.25 | 0.6398566371825318 | 0.000022868804229690044 | Phase: evaluation; full original reason retained [raw](evidence/raw/016-fremantle-orbit-phone-paired/fremantle-orbit-phone/result.json.gz) |
| sleeping-dog | desktop | unpaired / 017-sleeping-dog-desktop-unpaired | explained | — | 462.201 | 1494.64 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/017-sleeping-dog-desktop-unpaired/sleeping-dog-desktop/result.json.gz) |
| palace-statue | desktop | unpaired / 018-palace-statue-desktop-unpaired | explained | — | 20.760 | 1120.93 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/018-palace-statue-desktop-unpaired/palace-statue-desktop/result.json.gz) |
| ihasalu-orbit | phone | paired / 019-ihasalu-orbit-phone-paired | finished | 100.580 | 591.840 | 1612.71 | 0.6302147495533457 | 0.0001979302229957984 | Phase: evaluation; full original reason retained [raw](evidence/raw/019-ihasalu-orbit-phone-paired/ihasalu-orbit-phone/result.json.gz) |
| oa-street | desktop | unpaired / 020-oa-street-desktop-unpaired | explained | — | 22.560 | 1157.38 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/020-oa-street-desktop-unpaired/oa-street-desktop/result.json.gz) |
| ullard | desktop | unpaired / 021-ullard-desktop-unpaired | explained | — | 483.891 | 1471.39 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/021-ullard-desktop-unpaired/ullard-desktop/result.json.gz) |
| fresnel-lens | phone | paired / 022-fresnel-lens-phone-paired | finished | 136.892 | 628.351 | 1565.06 | 0.6962148736481286 | 0.000025261016756533563 | Phase: evaluation; full original reason retained [raw](evidence/raw/022-fresnel-lens-phone-paired/fresnel-lens-phone/result.json.gz) |
| snaefell | desktop | unpaired / 023-snaefell-desktop-unpaired | explained | — | 440.770 | 1557.34 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/023-snaefell-desktop-unpaired/snaefell-desktop/result.json.gz) |
| fremantle-orbit | desktop | unpaired / 024-fremantle-orbit-desktop-unpaired | explained | — | 437.209 | 1536.93 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/024-fremantle-orbit-desktop-unpaired/fremantle-orbit-desktop/result.json.gz) |
| saint-denis | phone | paired / 025-saint-denis-phone-paired | finished | 158.546 | 642.900 | 1617.28 | 0.2752636584479978 | 0.0038276362670470344 | Phase: evaluation; full original reason retained [raw](evidence/raw/025-saint-denis-phone-paired/saint-denis-phone/result.json.gz) |
| ihasalu-orbit | desktop | unpaired / 026-ihasalu-orbit-desktop-unpaired | explained | — | 443.693 | 1433.22 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/026-ihasalu-orbit-desktop-unpaired/ihasalu-orbit-desktop/result.json.gz) |
| horse-statue | phone | paired / 027-horse-statue-phone-paired | harness-error | 102.854 | 590.628 | 1626.91 | — | — | Phase: evaluation; full original reason retained [raw](evidence/raw/027-horse-statue-phone-paired/horse-statue-phone/result.json.gz) |
| fresnel-lens | desktop | unpaired / 028-fresnel-lens-desktop-unpaired | harness-error | 200.195 | 1166.260 | 1563.24 | — | — | Phase: evaluation; full original reason retained [raw](evidence/raw/028-fresnel-lens-desktop-unpaired/fresnel-lens-desktop/result.json.gz) |
| royal-sovereign | phone | paired / 029-royal-sovereign-phone-paired | finished | 87.609 | 576.949 | 1641.13 | 0.762026429334955 | 0.00037295267582352314 | Phase: evaluation; full original reason retained [raw](evidence/raw/029-royal-sovereign-phone-paired/royal-sovereign-phone/result.json.gz) |
| saint-denis | desktop | unpaired / 030-saint-denis-desktop-unpaired | explained | — | 438.129 | 1434.43 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/030-saint-denis-desktop-unpaired/saint-denis-desktop/result.json.gz) |
| viljandi-ruins | phone | paired / 031-viljandi-ruins-phone-paired | finished | 79.469 | 581.053 | 1636.61 | 0.6478765740500313 | 0.0004604788840906804 | Phase: evaluation; full original reason retained [raw](evidence/raw/031-viljandi-ruins-phone-paired/viljandi-ruins-phone/result.json.gz) |
| horse-statue | desktop | unpaired / 032-horse-statue-desktop-unpaired | explained | — | 438.889 | 1619.80 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/032-horse-statue-desktop-unpaired/horse-statue-desktop/result.json.gz) |
| kakerdi-bog | phone | paired / 033-kakerdi-bog-phone-paired | finished | 84.914 | 575.053 | 1595.86 | 0.5896300690497417 | 0.00015227734541159625 | Phase: evaluation; full original reason retained [raw](evidence/raw/033-kakerdi-bog-phone-paired/kakerdi-bog-phone/result.json.gz) |
| royal-sovereign | desktop | unpaired / 034-royal-sovereign-desktop-unpaired | explained | — | 443.533 | 1517.70 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/034-royal-sovereign-desktop-unpaired/royal-sovereign-desktop/result.json.gz) |
| pisac | phone | unpaired / 035-pisac-phone-unpaired | finished | 73.014 | 562.428 | 1655.62 | 0.5981348050281166 | 0.000452221556620739 | Phase: evaluation; full original reason retained [raw](evidence/raw/035-pisac-phone-unpaired/pisac-phone/result.json.gz) |
| viljandi-ruins | desktop | unpaired / 036-viljandi-ruins-desktop-unpaired | explained | — | 457.210 | 1446.54 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/036-viljandi-ruins-desktop-unpaired/viljandi-ruins-desktop/result.json.gz) |
| palace-statue | phone | unpaired / 037-palace-statue-phone-unpaired | finished | 65.613 | 554.795 | 1644.95 | 0.3871997056887555 | 0.0006956046845280445 | Phase: evaluation; full original reason retained [raw](evidence/raw/037-palace-statue-phone-unpaired/palace-statue-phone/result.json.gz) |
| kakerdi-bog | desktop | unpaired / 038-kakerdi-bog-desktop-unpaired | explained | — | 433.255 | 1450.00 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/038-kakerdi-bog-desktop-unpaired/kakerdi-bog-desktop/result.json.gz) |
| fjoloy | desktop | unpaired / 039-fjoloy-desktop-unpaired | explained | — | 458.001 | 1470.24 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/039-fjoloy-desktop-unpaired/fjoloy-desktop/result.json.gz) |
| fjoloy | phone | unpaired / 040-fjoloy-phone-unpaired | explained | — | 77.759 | 1005.76 | — | — | Phase: bake; full original reason retained [raw](evidence/raw/040-fjoloy-phone-unpaired/fjoloy-phone/result.json.gz) |

## Separate sample source cohorts

| Source cohort | Source commit | Status | Cases | Views |
|---|---|---|---:|---:|
| R12-frozen64ec | 64ec9ad5b7a90b590b289f6a02f0bbd50138db08 | completed-and-independently-pixel-verified | 12 | 74 |
| postmerge-2773 | 2773a1c4458e9f1894f3d3cac11b5631c5325384 | completed-and-independently-pixel-verified | 12 | 74 |

Sample preservation is independent of native-video quality. Postmerge sample bytes stay in their separate source cohort; no native64ec row is relabeled. Oversized images are lossless gzip with restore-map.json, never resized.

## Source credits and licenses

These facts are copied from the frozen manifest; this report does not claim new source-page verification.

| Clip | Author | License | Source |
|---|---|---|---|
| cat-track | Clément Bucco-Lechat | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [source](https://commons.wikimedia.org/wiki/File:Cat_playing_with_a_round_track_toy.webm) |
| cat-plays | Riverarvi | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [source](https://commons.wikimedia.org/wiki/File:Cat_Plays.webm) |
| buddha | https://www.youtube.com/user/Editor | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) | [source](https://commons.wikimedia.org/wiki/File:Statue_of_Buddha.webm) |
| chameleon-flowers | Ventrovert | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | [source](https://commons.wikimedia.org/wiki/File:Chameleon_on_ixora_flowers.webm) |
| dianthus | Tanvir Rahat | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [source](https://commons.wikimedia.org/wiki/File:Dianthus_plants_and_flowers_,_Rajshahi_,_Bangladesh.webm) |
| pisac | MorePix | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [source](https://commons.wikimedia.org/wiki/File:Panorama_of_P%C3%ADsac_Ruins,_Peru_2024.webm) |
| sleeping-dog | Amada44 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [source](https://commons.wikimedia.org/wiki/File:REM_-_Rapid_eye_movement_sleep_of_a_dog.webm) |
| palace-statue | Sayvhior | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [source](https://commons.wikimedia.org/wiki/File:A_moulded_statue_at_the_entrance_to_the_palace_of_the_Obi_of_Issele_Uku.webm) |
| oa-street | Sillerkiil | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [source](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Oa_street_in_Supilinn,_Tartu,_Estonia._July_2021.webm) |
| ullard | A.-K. D. | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [source](https://commons.wikimedia.org/wiki/File:Ullard_handball_alley.webm) |
| snaefell | Tiny Toast | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | [source](https://commons.wikimedia.org/wiki/File:Panorama_on_Snaefell.webm) |
| fremantle-orbit | JamesBromberger | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [source](https://commons.wikimedia.org/wiki/File:Orbit_around_Fremantle_South_Mole_Lighthouse_at_sunset.webm) |
| ihasalu-orbit | Sillerkiil | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [source](https://commons.wikimedia.org/wiki/File:Drone_video_of_abandoned_Ihasalu_lighthouse_near_Neeme_village_in_Estonia_(July_2022).webm) |
| fresnel-lens | Myotus | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [source](https://commons.wikimedia.org/wiki/File:Fresnel_lenses_rotating_at_Split_Rock_Lighthouse.webm) |
| saint-denis | Quahadi | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [source](https://commons.wikimedia.org/wiki/File:Interior_of_Basilique_Saint-Denis_134306.webm) |
| horse-statue | Angelarene88 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [source](https://commons.wikimedia.org/wiki/File:Traveler_horse_statue.webm) |
| royal-sovereign | Alexis Markwick | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [source](https://commons.wikimedia.org/wiki/File:Royal_Sovereign_Lighthouse_drone_visit.webm) |
| viljandi-ruins | Sillerkiil | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [source](https://commons.wikimedia.org/wiki/File:Viljandi_ordulinnus_2021,_droonivideo.webm) |
| kakerdi-bog | Sillerkiil | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | [source](https://commons.wikimedia.org/wiki/File:Drone_video_of_Kakerdi_lake_and_Kakerdaja_bog_in_Estonia,_september_2021.webm) |
| fjoloy | Rik Knops | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) | [source](https://commons.wikimedia.org/wiki/File:Aerial_views_of_Fj%C3%B8l%C3%B8y_Lighthouse,_Rennes%C3%B8y,_Rogaland_county,_Norway.webm) |

## Publication mapping

No published URLs supplied. Markdown artifact links are copied snapshot-relative evidence, not claims of publication.

Workspace source paths in JSON are provenance facts, not published hyperlinks. Root must publish copied relative artifacts or provide explicit source-path/byte-SHA/HTTPS mappings. Model metadata/full-case inventories are newly hash-bound unless the original row explicitly records the corresponding hash.
