/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// @ts-nocheck
//
// Verbatim data extracted from the standalone CLIT Autonomous Maintenance tool
// (clit_autonomous_maintenance.html) via scratchpad/extract_maintenance.cjs.
// DO NOT hand-edit the data blocks — re-run the extractor if the source changes.
// See memory: horae-growth-compass-swot (same extract-don't-retype discipline).

export const BASE_MACHINES = [
  {
    "id": "planetary-mixer",
    "name": "Planetary Mixer",
    "group": "Mixing",
    "icon": "mixer"
  },
  {
    "id": "pizza-oven",
    "name": "Pizza Oven",
    "group": "Baking",
    "icon": "oven"
  },
  {
    "id": "hot-choc",
    "name": "Hot Chocolate Machine",
    "group": "Beverage",
    "icon": "kettle"
  },
  {
    "id": "tabletop-mixer",
    "name": "Table Top Mixer",
    "group": "Mixing",
    "icon": "mixer-small"
  },
  {
    "id": "rotary-oven",
    "name": "Rotary Oven",
    "group": "Baking",
    "icon": "rotary"
  },
  {
    "id": "proofing-chamber",
    "name": "Proofing Chamber",
    "group": "Prep",
    "icon": "chamber"
  },
  {
    "id": "spiral-mixer",
    "name": "Spiral Mixer",
    "group": "Mixing",
    "icon": "spiral"
  },
  {
    "id": "dough-sheeter",
    "name": "Dough Sheeter",
    "group": "Prep",
    "icon": "sheeter"
  },
  {
    "id": "single-freezer",
    "name": "Single Door Freezer",
    "group": "Cold Storage",
    "icon": "freezer1"
  },
  {
    "id": "four-chiller",
    "name": "Four Door Chiller",
    "group": "Cold Storage",
    "icon": "chiller4"
  },
  {
    "id": "single-chiller",
    "name": "Single Door Chiller",
    "group": "Cold Storage",
    "icon": "chiller1"
  },
  {
    "id": "tank-fryer",
    "name": "Tank Fryer",
    "group": "Frying",
    "icon": "fryer"
  },
  {
    "id": "double-chiller",
    "name": "Double Door Chiller",
    "group": "Cold Storage",
    "icon": "chiller2"
  },
  {
    "id": "triple-chiller",
    "name": "Triple Door Chiller",
    "group": "Cold Storage",
    "icon": "chiller3"
  },
  {
    "id": "deck-oven",
    "name": "Deck Oven",
    "group": "Baking",
    "icon": "oven"
  }
];

export const BASE_CHECKLISTS = {
  "planetary-mixer": [
    {
      "c": "Bowl & beater attachment",
      "p": "Clean",
      "std": "No residual dough/batter/cream, no caked debris",
      "freq": "Daily",
      "method": "Damp cloth + sanitiser"
    },
    {
      "c": "Gearbox lubrication point",
      "p": "Lubricate",
      "std": "Grease nipple filled per colour-code (red = daily)",
      "freq": "Daily",
      "method": "Grease gun, FDA grease"
    },
    {
      "c": "Drive belt assembly",
      "p": "Inspect",
      "std": "No fraying, cracking, abnormal noise, or visible slack",
      "freq": "Weekly",
      "method": "Visual + manual check"
    },
    {
      "c": "Bowl locking lever & bolts",
      "p": "Tighten",
      "std": "Bowl locks firmly, no play in bowl mount",
      "freq": "Weekly",
      "method": "Spanner adjustment"
    }
  ],
  "pizza-oven": [
    {
      "c": "Stone deck surface",
      "p": "Clean",
      "std": "Free of charred residue and flour buildup",
      "freq": "Daily",
      "method": "Brush + scraper"
    },
    {
      "c": "Door seal & viewing glass",
      "p": "Inspect",
      "std": "No cracks in glass, seal intact, no smoke leakage",
      "freq": "Weekly",
      "method": "Visual inspection"
    },
    {
      "c": "Burner element",
      "p": "Inspect",
      "std": "Even flame colour, no soot accumulation",
      "freq": "Daily",
      "method": "Visual inspection"
    },
    {
      "c": "Door hinge bolts",
      "p": "Tighten",
      "std": "No sag in door, hinges firm",
      "freq": "Weekly",
      "method": "Allen key set"
    }
  ],
  "hot-choc": [
    {
      "c": "Mixing bowl & tap",
      "p": "Clean",
      "std": "No dried chocolate residue in bowl or nozzle",
      "freq": "Daily",
      "method": "Hot water + sanitiser"
    },
    {
      "c": "Auger blade",
      "p": "Inspect",
      "std": "Smooth rotation, no chocolate crusting on shaft",
      "freq": "Daily",
      "method": "Visual + manual check"
    },
    {
      "c": "Heating element seal",
      "p": "Inspect",
      "std": "No leakage at element gasket, even heat",
      "freq": "Weekly",
      "method": "Visual inspection"
    }
  ],
  "tabletop-mixer": [
    {
      "c": "Bowl & attachment",
      "p": "Clean",
      "std": "No residual batter/cream, attachment free of buildup",
      "freq": "Daily",
      "method": "Damp cloth + sanitiser"
    },
    {
      "c": "Speed control vents",
      "p": "Inspect",
      "std": "No unusual noise, vents free of flour dust",
      "freq": "Weekly",
      "method": "Visual + audible check"
    },
    {
      "c": "Base mounting screws",
      "p": "Tighten",
      "std": "No wobble or vibration during operation",
      "freq": "Weekly",
      "method": "Screwdriver"
    }
  ],
  "rotary-oven": [
    {
      "c": "Trolley rotation mechanism",
      "p": "Clean",
      "std": "Trolley free of residue; arm clear of debris",
      "freq": "Daily",
      "method": "Brush + degreaser"
    },
    {
      "c": "Rotation motor chain",
      "p": "Lubricate",
      "std": "Chain lightly oiled, smooth rotation without jerks",
      "freq": "Weekly",
      "method": "Food-grade oil"
    },
    {
      "c": "Door seal & steam vent",
      "p": "Inspect",
      "std": "Seal intact, steam vent unobstructed",
      "freq": "Weekly",
      "method": "Visual inspection"
    },
    {
      "c": "Burner components",
      "p": "Inspect",
      "std": "Even flame/heat colour, no soot",
      "freq": "Daily",
      "method": "Visual inspection"
    }
  ],
  "proofing-chamber": [
    {
      "c": "Humidity tray reservoir",
      "p": "Clean",
      "std": "No mineral scale or mould residue",
      "freq": "Daily",
      "method": "Brush + descaling agent"
    },
    {
      "c": "Door gasket",
      "p": "Inspect",
      "std": "No tears, proper seal on closing",
      "freq": "Weekly",
      "method": "Visual inspection"
    },
    {
      "c": "Humidifier steam unit",
      "p": "Inspect",
      "std": "Even steam output, no leakage at fittings",
      "freq": "Weekly",
      "method": "Visual inspection"
    }
  ],
  "spiral-mixer": [
    {
      "c": "Bowl & spiral hook",
      "p": "Clean",
      "std": "No dough residue on bowl wall or safety guard",
      "freq": "Daily",
      "method": "Damp cloth + sanitiser"
    },
    {
      "c": "Gearbox lubrication",
      "p": "Lubricate",
      "std": "Grease nipple filled (yellow = weekly)",
      "freq": "Weekly",
      "method": "Grease gun"
    },
    {
      "c": "Bowl guard switch",
      "p": "Inspect",
      "std": "Safety guard interlock functions correctly",
      "freq": "Daily",
      "method": "Functional test"
    },
    {
      "c": "Drive coupling bolts",
      "p": "Tighten",
      "std": "No play or looseness in bowl drive coupling",
      "freq": "Weekly",
      "method": "Spanner set"
    }
  ],
  "dough-sheeter": [
    {
      "c": "Rollers & conveyor belt",
      "p": "Clean",
      "std": "Rollers and belt free of dried dough/flour cake",
      "freq": "Daily",
      "method": "Brush + dry cloth"
    },
    {
      "c": "Roller bearings",
      "p": "Lubricate",
      "std": "Bearings lightly oiled, smooth roller rotation",
      "freq": "Weekly",
      "method": "Food-grade lubricant"
    },
    {
      "c": "Thickness dial gauge",
      "p": "Inspect",
      "std": "Adjustment dial moves freely, markings legible",
      "freq": "Weekly",
      "method": "Manual check"
    },
    {
      "c": "Belt tension bolts",
      "p": "Tighten",
      "std": "Belt tracks straight, no slippage under load",
      "freq": "Weekly",
      "method": "Spanner set"
    }
  ],
  "single-freezer": [
    {
      "c": "Door gasket frame",
      "p": "Clean",
      "std": "Free of frost buildup and food residue",
      "freq": "Weekly",
      "method": "Damp cloth + detergent"
    },
    {
      "c": "Condenser coil unit",
      "p": "Clean",
      "std": "Free of dust/lint buildup at the rear or base",
      "freq": "Weekly",
      "method": "Soft brush / vacuum"
    },
    {
      "c": "Door seal integrity",
      "p": "Inspect",
      "std": "Full seal contact, no gaps on closing",
      "freq": "Weekly",
      "method": "Paper-slip check"
    },
    {
      "c": "Door hinge mountings",
      "p": "Tighten",
      "std": "Door closes flush, no sagging at hinge",
      "freq": "Weekly",
      "method": "Screwdriver check"
    }
  ],
  "four-chiller": [
    {
      "c": "Door gaskets (All)",
      "p": "Clean",
      "std": "Free of food residue and condensation mould",
      "freq": "Weekly",
      "method": "Damp cloth"
    },
    {
      "c": "Condenser coil & fan",
      "p": "Clean",
      "std": "Free of dust/lint, fan blades unobstructed",
      "freq": "Weekly",
      "method": "Soft brush"
    },
    {
      "c": "Temperature probe",
      "p": "Inspect",
      "std": "Reading matches reference within ±2°C",
      "freq": "Weekly",
      "method": "Reference probe"
    },
    {
      "c": "Door hinges framework",
      "p": "Tighten",
      "std": "Each door closes flush with no sagging",
      "freq": "Weekly",
      "method": "Screwdriver set"
    }
  ],
  "single-chiller": [
    {
      "c": "Door gasket tracking",
      "p": "Clean",
      "std": "Free of food residue and condensation mould",
      "freq": "Weekly",
      "method": "Damp cloth"
    },
    {
      "c": "Condenser cooling coil",
      "p": "Clean",
      "std": "Free of dust and lint accumulation",
      "freq": "Weekly",
      "method": "Vacuum / brush"
    },
    {
      "c": "Temperature display",
      "p": "Inspect",
      "std": "Reading matches calibrated reference within ±2°C",
      "freq": "Weekly",
      "method": "Reference digital probe"
    }
  ],
  "tank-fryer": [
    {
      "c": "Oil tank filter basket",
      "p": "Clean",
      "std": "Free of carbonised crumbs; oil filtered regular",
      "freq": "Daily",
      "method": "Filter brush rinse"
    },
    {
      "c": "Thermostat reading",
      "p": "Inspect",
      "std": "Reading matches reference within ±2°C",
      "freq": "Weekly",
      "method": "Reference thermometer"
    },
    {
      "c": "Drain valve mounts",
      "p": "Tighten",
      "std": "No vibration-induced looseness, valve seals completely",
      "freq": "Weekly",
      "method": "Spanner validation"
    }
  ],
  "double-chiller": [
    {
      "c": "Door gaskets (Both)",
      "p": "Clean",
      "std": "Free of food residue/mould on both doors",
      "freq": "Weekly",
      "method": "Damp cloth"
    },
    {
      "c": "Condenser coil bank",
      "p": "Clean",
      "std": "Free of dust/lint accumulation",
      "freq": "Weekly",
      "method": "Soft brush check"
    },
    {
      "c": "Temperature indicator",
      "p": "Inspect",
      "std": "Reading matches calibrated reference within ±2°C",
      "freq": "Weekly",
      "method": "Reference digital probe"
    }
  ],
  "triple-chiller": [
    {
      "c": "Door gaskets (All 3)",
      "p": "Clean",
      "std": "Free of food residue and condensation tracking",
      "freq": "Weekly",
      "method": "Damp cloth"
    },
    {
      "c": "Condenser coil assembly",
      "p": "Clean",
      "std": "Free of dust, fan blades run unobstructed",
      "freq": "Weekly",
      "method": "Vacuum check"
    },
    {
      "c": "Door hinge pins",
      "p": "Tighten",
      "std": "Each door closes completely flush with zero sag",
      "freq": "Weekly",
      "method": "Spanner adjustment"
    }
  ],
  "deck-oven": [
    {
      "c": "Door seal configuration",
      "p": "Clean",
      "std": "Free of carbon buildup, sealing surface true",
      "freq": "Daily",
      "method": "Soft brush + degreaser"
    },
    {
      "c": "Heating element pack",
      "p": "Inspect",
      "std": "Even heat signature across chamber, no soot tracking",
      "freq": "Daily",
      "method": "Visual review"
    },
    {
      "c": "Hinge assembly bolts",
      "p": "Tighten",
      "std": "No door sagging present, mechanism firm",
      "freq": "Weekly",
      "method": "Spanner validation"
    }
  ]
};

export const MACHINE_NAME_TRANSLIT = {
  "planetary-mixer": {
    "kn": "ಪ್ಲಾನೆಟರಿ ಮಿಕ್ಸರ್",
    "hi": "प्लेनेटरी मिक्सर",
    "ta": "பிளானெட்டரி மிக்சர்"
  },
  "pizza-oven": {
    "kn": "ಪಿಜ್ಜಾ ಓವನ್",
    "hi": "पिज़्ज़ा ओवन",
    "ta": "பீட்சா ஓவன்"
  },
  "hot-choc": {
    "kn": "ಹಾಟ್ ಚಾಕಲೇಟ್ ಮಷೀನ್",
    "hi": "हॉट चॉकलेट मशीन",
    "ta": "ஹாட் சாக்லேட் மெஷின்"
  },
  "tabletop-mixer": {
    "kn": "ಟೇಬಲ್ ಟಾಪ್ ಮಿಕ್ಸರ್",
    "hi": "टेबल टॉप मिक्सर",
    "ta": "டேபிள் டாப் மிக்சர்"
  },
  "rotary-oven": {
    "kn": "ರೋಟರಿ ಓವನ್",
    "hi": "रोटरी ओवन",
    "ta": "ரோட்டரி ஓவன்"
  },
  "proofing-chamber": {
    "kn": "ಪ್ರೂಫಿಂಗ್ ಚೇಂಬರ್",
    "hi": "प्रूफिंग चैंबर",
    "ta": "ப்ரூஃபிங் சேம்பர்"
  },
  "spiral-mixer": {
    "kn": "ಸ್ಪಿರಲ್ ಮಿಕ್ಸರ್",
    "hi": "स्पाइरल मिक्सर",
    "ta": "ஸ்பைரல் மிக்சர்"
  },
  "dough-sheeter": {
    "kn": "ಡೋ ಶೀಟರ್",
    "hi": "डो शीटर",
    "ta": "டோ ஷீட்டர்"
  },
  "single-freezer": {
    "kn": "ಸಿಂಗಲ್ ಡೋರ್ ಫ್ರೀಜರ್",
    "hi": "सिंगल डोर फ्रीज़र",
    "ta": "சிங்கிள் டோர் ஃப்ரீசர்"
  },
  "four-chiller": {
    "kn": "ಫೋರ್ ಡೋರ್ ಚಿಲ್ಲರ್",
    "hi": "फोर डोर चिलर",
    "ta": "ஃபோர் டோர் சில்லர்"
  },
  "single-chiller": {
    "kn": "ಸಿಂಗಲ್ ಡೋರ್ ಚಿಲ್ಲರ್",
    "hi": "सिंगल डोर चिलर",
    "ta": "சிங்கிள் டோர் சில்லர்"
  },
  "tank-fryer": {
    "kn": "ಟ್ಯಾಂಕ್ ಫ್ರೈಯರ್",
    "hi": "टैंक फ्रायर",
    "ta": "டேங்க் ஃப்ரையர்"
  },
  "double-chiller": {
    "kn": "ಡಬಲ್ ಡೋರ್ ಚಿಲ್ಲರ್",
    "hi": "डबल डोर चिलर",
    "ta": "டபுள் டோர் சில்லர்"
  },
  "triple-chiller": {
    "kn": "ಟ್ರಿಪಲ್ ಡೋರ್ ಚಿಲ್ಲರ್",
    "hi": "ट्रिपल डोर चिलर",
    "ta": "டிரிபல் டோர் சில்லர்"
  },
  "deck-oven": {
    "kn": "ಡೆಕ್ ಓವನ್",
    "hi": "डेक ओवन",
    "ta": "டெக் ஓவன்"
  }
};

export const PARAM_COLORS = {
  "Clean": "blue",
  "Lubricate": "amber",
  "Inspect": "green",
  "Tighten": "red"
};

export const AUDIT_PARAMS = [
  {
    "name": "Machine Cleanliness Standards",
    "desc": "Visible cleanliness of machine architecture, structural floor footprint, and general hygiene standard."
  },
  {
    "name": "Lubrication Tracking Compliance",
    "desc": "Color-coded endpoints serviced according to designated intervals without overgreasing."
  },
  {
    "name": "Schedule Entry Adherence",
    "desc": "Checklist items populated contemporaneously without retrospective pattern writing."
  },
  {
    "name": "Defect Log Verification",
    "desc": "All failed flags match active logs within the tracking center for transparent reporting."
  },
  {
    "name": "Visual Identity Systems",
    "desc": "Laminated documentation, shadow boards, and visual placards intact and readable."
  }
];

export const GRADING = [
  {
    "score": 1,
    "label": "Critical failure",
    "desc": "Zero compliance; operational escalation"
  },
  {
    "score": 2,
    "label": "Poor Condition",
    "desc": "Significant system failures; fix within 48h"
  },
  {
    "score": 3,
    "label": "Acceptable Tier",
    "desc": "Minor standard drift; resolve within 1 week"
  },
  {
    "score": 4,
    "label": "Good Standard",
    "desc": "Operational compliance with isolated comments"
  },
  {
    "score": 5,
    "label": "Excellent Execution",
    "desc": "Flawless systemic compliance, master line standard"
  }
];

export const ROLE_LABELS = {
  "technician": "Technician",
  "manager": "Maintenance Manager",
  "qc": "QC Executive",
  "admin": "Super Admin",
  "qclead": "QC Lead",
  "sponsor": "Sponsor"
};

export const ICONS = {
  "mixer": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 30c0 10 5 18 12 18s12-8 12-18\" /><ellipse cx=\"32\" cy=\"30\" rx=\"14\" ry=\"5\" /><path d=\"M32 12v10\" /><path d=\"M25 8h14l-2 6H27z\" /><path d=\"M32 22c3 0 5 2 5 4\" /><rect x=\"14\" y=\"48\" width=\"36\" height=\"4\" rx=\"1\" /></svg>",
  "mixer-small": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><ellipse cx=\"30\" cy=\"34\" rx=\"11\" ry=\"4\" /><path d=\"M21 34c0 7 4 13 9 13s9-6 9-13\" /><path d=\"M30 18v8\" /><path d=\"M25 14h10l-1 4h-8z\" /><rect x=\"40\" y=\"10\" width=\"6\" height=\"20\" rx=\"2\" /><path d=\"M43 30v4\" /></svg>",
  "oven": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"10\" y=\"14\" width=\"44\" height=\"38\" rx=\"2\" /><rect x=\"15\" y=\"20\" width=\"34\" height=\"22\" rx=\"1.5\" /><circle cx=\"20\" cy=\"48\" r=\"1.6\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"26\" cy=\"48\" r=\"1.6\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M44 48h6\" /></svg>",
  "kettle": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 26h28v18a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6z\" /><path d=\"M46 30c6 1 6 9 0 10\" /><path d=\"M24 26v-4a8 8 0 0 1 16 0v4\" /><rect x=\"28\" y=\"42\" width=\"3\" height=\"6\" fill=\"currentColor\" stroke=\"none\"/></svg>",
  "rotary": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"12\" width=\"46\" height=\"40\" rx=\"2\" /><circle cx=\"32\" cy=\"32\" r=\"13\" /><path d=\"M32 19v0\" /><path d=\"M32 45v0\" /><path d=\"M19 32h0\" /><path d=\"M45 32h0\" /><path d=\"M32 32l8-5\" /></svg>",
  "chamber": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"14\" y=\"9\" width=\"36\" height=\"46\" rx=\"2\" /><path d=\"M14 21h36M14 31h36M14 41h36\" /><path d=\"M20 9v46M44 9v46\" stroke-dasharray=\"2 3\"/></svg>",
  "spiral": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><ellipse cx=\"32\" cy=\"36\" rx=\"16\" ry=\"6\" /><path d=\"M19 36c0 8 6 14 13 14s13-6 13-14\" /><path d=\"M32 30c-3-6 1-10 4-12s2-6-1-7\" /><rect x=\"46\" y=\"12\" width=\"6\" height=\"16\" rx=\"2\" /></svg>",
  "sheeter": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"8\" y=\"26\" width=\"48\" height=\"6\" rx=\"3\" /><rect x=\"8\" y=\"38\" width=\"48\" height=\"6\" rx=\"3\" /><path d=\"M14 20v6M50 20v6M14 44v6M50 44v6\" /><path d=\"M22 14h20\" stroke-dasharray=\"2 3\"/></svg>",
  "freezer1": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"16\" y=\"8\" width=\"32\" height=\"48\" rx=\"2\" /><path d=\"M32 8v48\" /><path d=\"M40 30v6M40 33h-6\" /><circle cx=\"22\" cy=\"44\" r=\"1.6\" fill=\"currentColor\" stroke=\"none\"/></svg>",
  "chiller1": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"16\" y=\"8\" width=\"32\" height=\"48\" rx=\"2\" /><rect x=\"20\" y=\"14\" width=\"24\" height=\"30\" rx=\"1.5\" /><circle cx=\"22\" cy=\"50\" r=\"1.6\" fill=\"currentColor\" stroke=\"none\"/></svg>",
  "chiller2": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"8\" width=\"46\" height=\"48\" rx=\"2\" /><path d=\"M32 8v48\" /><rect x=\"13\" y=\"13\" width=\"15\" height=\"26\" rx=\"1.2\" /><rect x=\"36\" y=\"13\" width=\"15\" height=\"26\" rx=\"1.2\" /></svg>",
  "chiller3": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"6\" y=\"8\" width=\"52\" height=\"48\" rx=\"2\" /><path d=\"M22.6 8v48M41.3 8v48\" /><rect x=\"10\" y=\"13\" width=\"9\" height=\"26\" rx=\"1\"/><rect x=\"27\" y=\"13\" width=\"10\" height=\"26\" rx=\"1\"/><rect x=\"45\" y=\"13\" width=\"9\" height=\"26\" rx=\"1\"/></svg>",
  "chiller4": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"6\" width=\"46\" height=\"52\" rx=\"2\" /><path d=\"M32 6v52M9 32h46\" /><rect x=\"13\" y=\"10\" width=\"15\" height=\"18\" rx=\"1\"/><rect x=\"36\" y=\"10\" width=\"15\" height=\"18\" rx=\"1\"/><rect x=\"13\" y=\"36\" width=\"15\" height=\"18\" rx=\"1\"/><rect x=\"36\" y=\"36\" width=\"15\" height=\"18\" rx=\"1\"/></svg>",
  "fryer": "<svg viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 22h36v22a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z\" /><path d=\"M20 22v-4a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v4\" /><path d=\"M22 30v12M32 30v12M42 30v12\" stroke-dasharray=\"2 3\" /><rect x=\"28\" y=\"50\" width=\"8\" height=\"5\" fill=\"currentColor\" stroke=\"none\"/></svg>"
};

export const SOP_TEMPLATE_A = [
  [
    "Planetary Mixer – Bowl & Beater/Whisk",
    "Clean",
    "No residual dough/batter/cream, no caked debris on bowl wall or attachment",
    "Daily",
    "Damp cloth + food-grade sanitiser"
  ],
  [
    "Planetary Mixer – Gearbox Lubrication Point",
    "Lubricate",
    "Grease nipple filled per colour-code (red = daily)",
    "Daily",
    "Grease gun, FDA-grade grease"
  ],
  [
    "Planetary Mixer – Drive Belt / Gear Assembly",
    "Inspect",
    "No fraying, cracking, abnormal noise, or visible slack",
    "Weekly",
    "Visual + manual tension check"
  ],
  [
    "Planetary Mixer – Bowl Locking Lever & Bolts",
    "Tighten",
    "Bowl locks firmly, no play in bowl mount",
    "Weekly",
    "Spanner (size as per machine)"
  ],
  [
    "Pizza Oven – Stone Deck / Chamber Surface",
    "Clean",
    "Free of charred residue and flour buildup",
    "Daily",
    "Brush + scraper"
  ],
  [
    "Pizza Oven – Door Seal & Viewing Glass",
    "Inspect",
    "No cracks in glass, seal intact, no smoke leakage",
    "Weekly",
    "Visual inspection"
  ],
  [
    "Pizza Oven – Burner/Heating Element",
    "Inspect",
    "Even flame/heat colour, no soot accumulation",
    "Daily",
    "Visual inspection"
  ],
  [
    "Pizza Oven – Door Hinge & Panel Bolts",
    "Tighten",
    "No sag in door, hinges firm",
    "Weekly",
    "Allen key / spanner set"
  ],
  [
    "Hot Chocolate Machine – Mixing Bowl & Tap",
    "Clean",
    "No dried chocolate residue in bowl, tap, or dispensing nozzle",
    "Daily",
    "Hot water rinse + food-grade sanitiser"
  ],
  [
    "Hot Chocolate Machine – Auger/Stirring Blade",
    "Inspect",
    "Smooth rotation, no chocolate crusting on blade shaft",
    "Daily",
    "Visual + manual check"
  ],
  [
    "Hot Chocolate Machine – Heating Element Seal",
    "Inspect",
    "No leakage at element gasket, even heat distribution",
    "Weekly",
    "Visual inspection"
  ],
  [
    "Table Top Mixer – Bowl & Beater Attachment",
    "Clean",
    "No residual batter/cream, attachment free of buildup",
    "Daily",
    "Damp cloth + food-grade sanitiser"
  ],
  [
    "Table Top Mixer – Speed Control & Motor Vents",
    "Inspect",
    "No unusual noise/heat, vents free of flour dust",
    "Weekly",
    "Visual + audible check"
  ],
  [
    "Table Top Mixer – Base Mounting Screws",
    "Tighten",
    "No wobble or vibration during operation",
    "Weekly",
    "Screwdriver / spanner set"
  ],
  [
    "Rotary Oven – Trolley/Rack & Rotation Mechanism",
    "Clean",
    "Trolley free of baked-on residue; rotation arm clear of debris",
    "Daily",
    "Brush + degreaser"
  ],
  [
    "Rotary Oven – Rotation Motor & Chain",
    "Lubricate",
    "Chain/gear lightly oiled, smooth rotation with no jerks",
    "Weekly",
    "Food-grade chain oil"
  ],
  [
    "Rotary Oven – Door Seal & Steam Vent",
    "Inspect",
    "Seal intact, steam vent unobstructed",
    "Weekly",
    "Visual inspection"
  ],
  [
    "Rotary Oven – Burner/Heating Element",
    "Inspect",
    "Even flame/heat colour across chamber, no soot",
    "Daily",
    "Visual inspection"
  ],
  [
    "Proofing Chamber – Humidity Tray & Water Reservoir",
    "Clean",
    "No mineral scale or mould residue",
    "Daily",
    "Brush + descaling solution"
  ],
  [
    "Proofing Chamber – Door Gasket",
    "Inspect",
    "No tears, proper seal on closing",
    "Weekly",
    "Visual inspection"
  ],
  [
    "Proofing Chamber – Humidifier/Steam Unit",
    "Inspect",
    "Even steam output, no leakage at fittings",
    "Weekly",
    "Visual inspection"
  ],
  [
    "Spiral Mixer – Bowl & Spiral Hook",
    "Clean",
    "No dough residue on bowl wall, spiral hook, or guard",
    "Daily",
    "Damp cloth + food-grade sanitiser"
  ],
  [
    "Spiral Mixer – Gearbox Lubrication Point",
    "Lubricate",
    "Grease nipple filled per colour-code (yellow = weekly)",
    "Weekly",
    "Grease gun, FDA-grade grease"
  ],
  [
    "Spiral Mixer – Bowl Guard & Safety Switch",
    "Inspect",
    "Safety guard interlock functions correctly before each use",
    "Daily",
    "Functional check"
  ],
  [
    "Spiral Mixer – Bowl Drive Coupling Bolts",
    "Tighten",
    "No play or looseness in bowl drive coupling",
    "Weekly",
    "Spanner set"
  ],
  [
    "Dough Sheeter – Rollers & Conveyor Belt",
    "Clean",
    "Rollers and belt free of dried dough and flour cake-up",
    "Daily",
    "Brush + dry cloth"
  ],
  [
    "Dough Sheeter – Roller Bearings",
    "Lubricate",
    "Bearings lightly oiled, smooth roller rotation",
    "Weekly",
    "Food-grade lubricant"
  ],
  [
    "Dough Sheeter – Thickness Adjustment Mechanism",
    "Inspect",
    "Adjustment dial moves freely, gauge markings legible",
    "Weekly",
    "Visual + manual check"
  ],
  [
    "Dough Sheeter – Frame & Belt Tension Bolts",
    "Tighten",
    "Belt tracks straight, no slippage under load",
    "Weekly",
    "Spanner / Allen key set"
  ],
  [
    "Single Door Freezer – Door Gasket",
    "Clean",
    "Free of frost buildup and food residue",
    "Weekly",
    "Damp cloth + mild detergent"
  ],
  [
    "Single Door Freezer – Condenser Coil",
    "Clean",
    "Free of dust/lint buildup at the rear/base unit",
    "Weekly",
    "Soft brush / vacuum"
  ],
  [
    "Single Door Freezer – Door Seal Integrity",
    "Inspect",
    "Full seal contact, no gaps on closing",
    "Weekly",
    "Visual + paper-slip test"
  ],
  [
    "Single Door Freezer – Door Hinge & Handle",
    "Tighten",
    "Door closes flush, no sagging at hinge",
    "Weekly",
    "Screwdriver / spanner set"
  ],
  [
    "Four Door Chiller – Door Gaskets (All Doors)",
    "Clean",
    "Free of food residue and condensation mould on each door",
    "Weekly",
    "Damp cloth + mild detergent"
  ],
  [
    "Four Door Chiller – Condenser Coil & Fan",
    "Clean",
    "Free of dust/lint buildup, fan blades unobstructed",
    "Weekly",
    "Soft brush / vacuum"
  ],
  [
    "Four Door Chiller – Temperature Display & Probe",
    "Inspect",
    "Reading matches calibrated reference within ±2°C",
    "Weekly",
    "Calibrated reference thermometer"
  ],
  [
    "Four Door Chiller – Door Hinges (All Doors)",
    "Tighten",
    "Each door closes flush with no sagging",
    "Weekly",
    "Screwdriver / spanner set"
  ],
  [
    "Single Door Chiller – Door Gasket",
    "Clean",
    "Free of food residue and condensation mould",
    "Weekly",
    "Damp cloth + mild detergent"
  ],
  [
    "Single Door Chiller – Condenser Coil",
    "Clean",
    "Free of dust/lint buildup",
    "Weekly",
    "Soft brush / vacuum"
  ],
  [
    "Single Door Chiller – Temperature Display",
    "Inspect",
    "Reading matches calibrated reference within ±2°C",
    "Weekly",
    "Calibrated reference thermometer"
  ],
  [
    "Tank Fryer – Oil Tank & Filter Basket",
    "Clean",
    "Free of carbonised crumbs/debris; oil filtered per schedule",
    "Daily",
    "Filter brush, hot water rinse"
  ],
  [
    "Tank Fryer – Thermostat Probe",
    "Inspect",
    "Reading matches calibrated reference within ±2°C",
    "Weekly",
    "Calibrated reference thermometer"
  ],
  [
    "Tank Fryer – Mounting Bolts & Drain Valve",
    "Tighten",
    "No vibration-induced looseness at base; drain valve seals fully",
    "Weekly",
    "Spanner set"
  ],
  [
    "Double Door Chiller – Door Gaskets",
    "Clean",
    "Free of food residue and condensation mould on both doors",
    "Weekly",
    "Damp cloth + mild detergent"
  ],
  [
    "Double Door Chiller – Condenser Coil",
    "Clean",
    "Free of dust/lint buildup",
    "Weekly",
    "Soft brush / vacuum"
  ],
  [
    "Double Door Chiller – Temperature Display & Probe",
    "Inspect",
    "Reading matches calibrated reference within ±2°C",
    "Weekly",
    "Calibrated reference thermometer"
  ],
  [
    "Triple Door Chiller – Door Gaskets (All Doors)",
    "Clean",
    "Free of food residue and condensation mould on each door",
    "Weekly",
    "Damp cloth + mild detergent"
  ],
  [
    "Triple Door Chiller – Condenser Coil & Fan",
    "Clean",
    "Free of dust/lint buildup, fan blades unobstructed",
    "Weekly",
    "Soft brush / vacuum"
  ],
  [
    "Triple Door Chiller – Door Hinges (All Doors)",
    "Tighten",
    "Each door closes flush with no sagging",
    "Weekly",
    "Screwdriver / spanner set"
  ],
  [
    "Deck Oven – Door Seal/Gasket",
    "Clean",
    "Free of carbon buildup, seal intact",
    "Daily",
    "Soft brush + degreaser"
  ],
  [
    "Deck Oven – Burner/Heating Element",
    "Inspect",
    "Even flame/heat colour, no soot accumulation",
    "Daily",
    "Visual inspection"
  ],
  [
    "Deck Oven – Hinge & Door Bolts",
    "Tighten",
    "No sag in door, hinges firm",
    "Weekly",
    "Allen key / spanner set"
  ]
];

export const SOP_DOC_INFO = [
  [
    "Document Title",
    "SOP & Governance Framework: Autonomous Maintenance (CLIT) Implementation"
  ],
  [
    "Document Owner / Project Lead",
    "Faizal Hydrose"
  ],
  [
    "Project Sponsor",
    "Suhas K S"
  ],
  [
    "Project Operator",
    "Bharani"
  ],
  [
    "QC Lead",
    "Ranjana"
  ],
  [
    "Issue Date",
    "20 June 2026"
  ],
  [
    "Applicable Framework",
    "5S, Total Productive Maintenance (TPM), Six Sigma DMAIC, FSSAI Compliance"
  ],
  [
    "Document Status",
    "Implementation-Ready, Version 1.0"
  ]
];

export const SOP_CHAPTERS = [
  {
    "tag": "Section 1",
    "title": "Introduction & Operational Philosophy",
    "body": "\n      <h4>1.1 From Firefighting to a Proactive CLIT Model</h4>\n      <p>Across Bhatta&rsquo;s Foods&rsquo; distributed kitchen network &mdash; the Konanakunte Cross central bakery, the Jayanagar 4T Block demo and savouries kitchen, and the outlet-level kitchens at BTM Layout, HSR Layout, Sarjapur, Whitefield, and Kundapura &mdash; equipment maintenance has historically followed a reactive, &ldquo;firefighting&rdquo; model. Breakdowns are addressed only after a machine has already failed, typically during peak production windows when the cost of downtime is highest. This reactive posture creates three compounding risks for a food manufacturing operation: unplanned production stoppages that disrupt daily dispatch schedules to Cakewala outlets and Eshanya kitchens, inconsistent product quality arising from poorly maintained Planetary Mixers, Spiral Mixers, Table Top Mixers, Dough Sheeters, Deck Ovens, Pizza Ovens, Rotary Ovens, Proofing Chambers, Tank Fryers, and the Hot Chocolate Machine, and food-safety exposure where neglected refrigeration equipment &mdash; Single, Double, Triple, and Four Door Chillers, and Single Door Freezers &mdash; becomes a temperature-abuse or contamination risk under FSSAI norms.</p>\n      <p>This SOP formalises the transition to Autonomous Maintenance under the CLIT discipline &mdash; Clean, Lubricate, Inspect, and Tighten &mdash; embedded within the broader 5S (Sort, Set in Order, Shine, Standardise, Sustain) methodology. Under CLIT, the equipment operator or assigned technician performs small, frequent, standardised maintenance actions that catch wear and irregularities long before they escalate into breakdowns. This is not a replacement for planned/preventive maintenance; it is the first line of defence that feeds early-warning signals into the planned maintenance system via the Centralised Maintenance & Defect Log defined in Section 2.</p>\n      <p>The rationale for this shift rests on four operational pillars:</p>\n      <ul class=\"role-points\">\n        <li><strong>Production continuity:</strong> Bengaluru&rsquo;s bakery and QSR demand is time-bound (breakfast, evening snacking, and weekend peaks); an unplanned oven or fryer breakdown during these windows causes direct, unrecoverable sales loss across Cakewala outlets and Eshanya Street Food.</li>\n        <li><strong>Food safety and compliance:</strong> FSSAI&rsquo;s Food Safety Management System requirements expect documented equipment hygiene and maintenance records; CLIT checklists create that auditable trail.</li>\n        <li><strong>Cost of ownership:</strong> small, recurring CLIT actions (cleaning, lubrication, fastener checks) are dramatically cheaper than emergency repairs or premature equipment replacement, directly supporting Six Sigma cost-reduction objectives already active within the organisation.</li>\n        <li><strong>Workforce capability:</strong> CLIT builds basic equipment literacy among kitchen staff and technicians, reducing dependence on external service vendors for routine issues.</li>\n      </ul>\n      <h4>1.2 The Time-Boxing Strategy: 15&ndash;20 Minutes, No Exceptions</h4>\n      <p>The single greatest risk to CLIT adoption is team resistance &mdash; kitchen staff and technicians perceiving the routine as &ldquo;extra work&rdquo; layered onto an already demanding production schedule. To neutralise this, the CLIT routine is strictly time-boxed to 15&ndash;20 minutes per shift per machine, scheduled at a fixed point in the daily routine (typically immediately after the first production cycle cools down, or at shift handover).</p>\n      <p>Time-boxing works on three principles:</p>\n      <ul class=\"role-points\">\n        <li><strong>Fixed scope:</strong> the checklist in Section 2A lists only the specific components and parameters relevant to that machine &mdash; no open-ended &ldquo;inspect everything&rdquo; instructions. A technician with a laminated, pre-filled checklist completes the routine in minutes, not by interpretation.</li>\n        <li><strong>Fixed time slot:</strong> CLIT is scheduled, not squeezed in. It appears on the shift roster the same way a production task does, removing the perception that it competes with &ldquo;real work.&rdquo;</li>\n        <li><strong>Escalation, not resolution:</strong> technicians are explicitly instructed not to attempt repairs during the CLIT window. Anything beyond simple cleaning, lubrication, visual inspection, or fastener tightening is logged in the Defect Log (Section 2B) and handed off. This keeps the daily routine fast and prevents technicians from feeling they are now unpaid mechanics.</li>\n      </ul>\n      <h4>1.3 Visual Controls on the Shop Floor</h4>\n      <p>Visual management is what makes CLIT self-sustaining without constant supervisory intervention. The following visual controls are mandated at every kitchen location covered by this SOP:</p>\n      <ul class=\"role-points\">\n        <li><strong>Colour-coded lubrication points:</strong> every lubrication point on covered machines (Planetary Mixers, Spiral Mixers, Table Top Mixers, Rotary Ovens, Dough Sheeters, and Tank Fryers) is tagged with a coloured marker indicating lubricant type and frequency &mdash; for example, red for daily grease points, yellow for weekly oil points, green for monthly points. This removes ambiguity and prevents wrong-lubricant errors.</li>\n        <li><strong>Localised laminated checklists:</strong> a laminated, wipe-clean copy of the relevant Daily/Weekly CLIT Checklist (Section 2A) is mounted directly on or beside each machine, not stored in an office or binder. The technician marks it with a whiteboard marker each shift; the Maintenance Manager transcribes or photographs it into the centralised log weekly.</li>\n        <li><strong>Standard tagging for defect status:</strong> a simple red/yellow/green tag system is affixed to machines &mdash; red for &ldquo;stop, critical defect logged,&rdquo; yellow for &ldquo;operating with a logged non-critical defect,&rdquo; green for &ldquo;fully compliant.&rdquo; This gives any manager a one-glance status of the entire kitchen floor without opening a single log.</li>\n        <li><strong>Shadow boards for CLIT tools:</strong> cleaning and inspection tools (brushes, torque wrenches, lubrication guns) are stored on labelled shadow boards near each machine, consistent with 5S &ldquo;Set in Order&rdquo; principles, so the 15&ndash;20 minute window is never lost searching for tools.</li>\n      </ul>"
  },
  {
    "tag": "Section 2",
    "title": "The CLIT Tooling Templates",
    "body": "\n      <p>The following three templates form the operational backbone of this SOP. They are designed to be printed and used directly on the shop floor (Templates A and C) and maintained centrally by the Maintenance Manager (Template B). All templates use plain-language fields suitable for technicians with varying literacy levels, supported by the visual controls described in Section 1.3.</p>\n      <h4>Template A: Daily / Weekly Machine-Side CLIT Checklist</h4>\n      <p>Print and laminate one copy per machine. Mount at the point of use. Mark daily; transcribe weekly into the centralised system.</p>\n      <div class=\"checklist-table-wrap\" style=\"margin-bottom:16px;\">\n        <table class=\"checklist-table\">\n          <thead><tr><th>Machine Component</th><th>Parameter</th><th>Standard Expected</th><th>Frequency</th><th>Method / Tool</th></tr></thead>\n          <tbody>\n            <tr><td>Planetary Mixer – Bowl & Beater/Whisk</td><td>Clean</td><td class=\"muted-cell\">No residual dough/batter/cream, no caked debris on bowl wall or attachment</td><td>Daily</td><td class=\"muted-cell\">Damp cloth + food-grade sanitiser</td></tr><tr><td>Planetary Mixer – Gearbox Lubrication Point</td><td>Lubricate</td><td class=\"muted-cell\">Grease nipple filled per colour-code (red = daily)</td><td>Daily</td><td class=\"muted-cell\">Grease gun, FDA-grade grease</td></tr><tr><td>Planetary Mixer – Drive Belt / Gear Assembly</td><td>Inspect</td><td class=\"muted-cell\">No fraying, cracking, abnormal noise, or visible slack</td><td>Weekly</td><td class=\"muted-cell\">Visual + manual tension check</td></tr><tr><td>Planetary Mixer – Bowl Locking Lever & Bolts</td><td>Tighten</td><td class=\"muted-cell\">Bowl locks firmly, no play in bowl mount</td><td>Weekly</td><td class=\"muted-cell\">Spanner (size as per machine)</td></tr><tr><td>Pizza Oven – Stone Deck / Chamber Surface</td><td>Clean</td><td class=\"muted-cell\">Free of charred residue and flour buildup</td><td>Daily</td><td class=\"muted-cell\">Brush + scraper</td></tr><tr><td>Pizza Oven – Door Seal & Viewing Glass</td><td>Inspect</td><td class=\"muted-cell\">No cracks in glass, seal intact, no smoke leakage</td><td>Weekly</td><td class=\"muted-cell\">Visual inspection</td></tr><tr><td>Pizza Oven – Burner/Heating Element</td><td>Inspect</td><td class=\"muted-cell\">Even flame/heat colour, no soot accumulation</td><td>Daily</td><td class=\"muted-cell\">Visual inspection</td></tr><tr><td>Pizza Oven – Door Hinge & Panel Bolts</td><td>Tighten</td><td class=\"muted-cell\">No sag in door, hinges firm</td><td>Weekly</td><td class=\"muted-cell\">Allen key / spanner set</td></tr><tr><td>Hot Chocolate Machine – Mixing Bowl & Tap</td><td>Clean</td><td class=\"muted-cell\">No dried chocolate residue in bowl, tap, or dispensing nozzle</td><td>Daily</td><td class=\"muted-cell\">Hot water rinse + food-grade sanitiser</td></tr><tr><td>Hot Chocolate Machine – Auger/Stirring Blade</td><td>Inspect</td><td class=\"muted-cell\">Smooth rotation, no chocolate crusting on blade shaft</td><td>Daily</td><td class=\"muted-cell\">Visual + manual check</td></tr><tr><td>Hot Chocolate Machine – Heating Element Seal</td><td>Inspect</td><td class=\"muted-cell\">No leakage at element gasket, even heat distribution</td><td>Weekly</td><td class=\"muted-cell\">Visual inspection</td></tr><tr><td>Table Top Mixer – Bowl & Beater Attachment</td><td>Clean</td><td class=\"muted-cell\">No residual batter/cream, attachment free of buildup</td><td>Daily</td><td class=\"muted-cell\">Damp cloth + food-grade sanitiser</td></tr><tr><td>Table Top Mixer – Speed Control & Motor Vents</td><td>Inspect</td><td class=\"muted-cell\">No unusual noise/heat, vents free of flour dust</td><td>Weekly</td><td class=\"muted-cell\">Visual + audible check</td></tr><tr><td>Table Top Mixer – Base Mounting Screws</td><td>Tighten</td><td class=\"muted-cell\">No wobble or vibration during operation</td><td>Weekly</td><td class=\"muted-cell\">Screwdriver / spanner set</td></tr><tr><td>Rotary Oven – Trolley/Rack & Rotation Mechanism</td><td>Clean</td><td class=\"muted-cell\">Trolley free of baked-on residue; rotation arm clear of debris</td><td>Daily</td><td class=\"muted-cell\">Brush + degreaser</td></tr><tr><td>Rotary Oven – Rotation Motor & Chain</td><td>Lubricate</td><td class=\"muted-cell\">Chain/gear lightly oiled, smooth rotation with no jerks</td><td>Weekly</td><td class=\"muted-cell\">Food-grade chain oil</td></tr><tr><td>Rotary Oven – Door Seal & Steam Vent</td><td>Inspect</td><td class=\"muted-cell\">Seal intact, steam vent unobstructed</td><td>Weekly</td><td class=\"muted-cell\">Visual inspection</td></tr><tr><td>Rotary Oven – Burner/Heating Element</td><td>Inspect</td><td class=\"muted-cell\">Even flame/heat colour across chamber, no soot</td><td>Daily</td><td class=\"muted-cell\">Visual inspection</td></tr><tr><td>Proofing Chamber – Humidity Tray & Water Reservoir</td><td>Clean</td><td class=\"muted-cell\">No mineral scale or mould residue</td><td>Daily</td><td class=\"muted-cell\">Brush + descaling solution</td></tr><tr><td>Proofing Chamber – Door Gasket</td><td>Inspect</td><td class=\"muted-cell\">No tears, proper seal on closing</td><td>Weekly</td><td class=\"muted-cell\">Visual inspection</td></tr><tr><td>Proofing Chamber – Humidifier/Steam Unit</td><td>Inspect</td><td class=\"muted-cell\">Even steam output, no leakage at fittings</td><td>Weekly</td><td class=\"muted-cell\">Visual inspection</td></tr><tr><td>Spiral Mixer – Bowl & Spiral Hook</td><td>Clean</td><td class=\"muted-cell\">No dough residue on bowl wall, spiral hook, or guard</td><td>Daily</td><td class=\"muted-cell\">Damp cloth + food-grade sanitiser</td></tr><tr><td>Spiral Mixer – Gearbox Lubrication Point</td><td>Lubricate</td><td class=\"muted-cell\">Grease nipple filled per colour-code (yellow = weekly)</td><td>Weekly</td><td class=\"muted-cell\">Grease gun, FDA-grade grease</td></tr><tr><td>Spiral Mixer – Bowl Guard & Safety Switch</td><td>Inspect</td><td class=\"muted-cell\">Safety guard interlock functions correctly before each use</td><td>Daily</td><td class=\"muted-cell\">Functional check</td></tr><tr><td>Spiral Mixer – Bowl Drive Coupling Bolts</td><td>Tighten</td><td class=\"muted-cell\">No play or looseness in bowl drive coupling</td><td>Weekly</td><td class=\"muted-cell\">Spanner set</td></tr><tr><td>Dough Sheeter – Rollers & Conveyor Belt</td><td>Clean</td><td class=\"muted-cell\">Rollers and belt free of dried dough and flour cake-up</td><td>Daily</td><td class=\"muted-cell\">Brush + dry cloth</td></tr><tr><td>Dough Sheeter – Roller Bearings</td><td>Lubricate</td><td class=\"muted-cell\">Bearings lightly oiled, smooth roller rotation</td><td>Weekly</td><td class=\"muted-cell\">Food-grade lubricant</td></tr><tr><td>Dough Sheeter – Thickness Adjustment Mechanism</td><td>Inspect</td><td class=\"muted-cell\">Adjustment dial moves freely, gauge markings legible</td><td>Weekly</td><td class=\"muted-cell\">Visual + manual check</td></tr><tr><td>Dough Sheeter – Frame & Belt Tension Bolts</td><td>Tighten</td><td class=\"muted-cell\">Belt tracks straight, no slippage under load</td><td>Weekly</td><td class=\"muted-cell\">Spanner / Allen key set</td></tr><tr><td>Single Door Freezer – Door Gasket</td><td>Clean</td><td class=\"muted-cell\">Free of frost buildup and food residue</td><td>Weekly</td><td class=\"muted-cell\">Damp cloth + mild detergent</td></tr><tr><td>Single Door Freezer – Condenser Coil</td><td>Clean</td><td class=\"muted-cell\">Free of dust/lint buildup at the rear/base unit</td><td>Weekly</td><td class=\"muted-cell\">Soft brush / vacuum</td></tr><tr><td>Single Door Freezer – Door Seal Integrity</td><td>Inspect</td><td class=\"muted-cell\">Full seal contact, no gaps on closing</td><td>Weekly</td><td class=\"muted-cell\">Visual + paper-slip test</td></tr><tr><td>Single Door Freezer – Door Hinge & Handle</td><td>Tighten</td><td class=\"muted-cell\">Door closes flush, no sagging at hinge</td><td>Weekly</td><td class=\"muted-cell\">Screwdriver / spanner set</td></tr><tr><td>Four Door Chiller – Door Gaskets (All Doors)</td><td>Clean</td><td class=\"muted-cell\">Free of food residue and condensation mould on each door</td><td>Weekly</td><td class=\"muted-cell\">Damp cloth + mild detergent</td></tr><tr><td>Four Door Chiller – Condenser Coil & Fan</td><td>Clean</td><td class=\"muted-cell\">Free of dust/lint buildup, fan blades unobstructed</td><td>Weekly</td><td class=\"muted-cell\">Soft brush / vacuum</td></tr><tr><td>Four Door Chiller – Temperature Display & Probe</td><td>Inspect</td><td class=\"muted-cell\">Reading matches calibrated reference within ±2°C</td><td>Weekly</td><td class=\"muted-cell\">Calibrated reference thermometer</td></tr><tr><td>Four Door Chiller – Door Hinges (All Doors)</td><td>Tighten</td><td class=\"muted-cell\">Each door closes flush with no sagging</td><td>Weekly</td><td class=\"muted-cell\">Screwdriver / spanner set</td></tr><tr><td>Single Door Chiller – Door Gasket</td><td>Clean</td><td class=\"muted-cell\">Free of food residue and condensation mould</td><td>Weekly</td><td class=\"muted-cell\">Damp cloth + mild detergent</td></tr><tr><td>Single Door Chiller – Condenser Coil</td><td>Clean</td><td class=\"muted-cell\">Free of dust/lint buildup</td><td>Weekly</td><td class=\"muted-cell\">Soft brush / vacuum</td></tr><tr><td>Single Door Chiller – Temperature Display</td><td>Inspect</td><td class=\"muted-cell\">Reading matches calibrated reference within ±2°C</td><td>Weekly</td><td class=\"muted-cell\">Calibrated reference thermometer</td></tr><tr><td>Tank Fryer – Oil Tank & Filter Basket</td><td>Clean</td><td class=\"muted-cell\">Free of carbonised crumbs/debris; oil filtered per schedule</td><td>Daily</td><td class=\"muted-cell\">Filter brush, hot water rinse</td></tr><tr><td>Tank Fryer – Thermostat Probe</td><td>Inspect</td><td class=\"muted-cell\">Reading matches calibrated reference within ±2°C</td><td>Weekly</td><td class=\"muted-cell\">Calibrated reference thermometer</td></tr><tr><td>Tank Fryer – Mounting Bolts & Drain Valve</td><td>Tighten</td><td class=\"muted-cell\">No vibration-induced looseness at base; drain valve seals fully</td><td>Weekly</td><td class=\"muted-cell\">Spanner set</td></tr><tr><td>Double Door Chiller – Door Gaskets</td><td>Clean</td><td class=\"muted-cell\">Free of food residue and condensation mould on both doors</td><td>Weekly</td><td class=\"muted-cell\">Damp cloth + mild detergent</td></tr><tr><td>Double Door Chiller – Condenser Coil</td><td>Clean</td><td class=\"muted-cell\">Free of dust/lint buildup</td><td>Weekly</td><td class=\"muted-cell\">Soft brush / vacuum</td></tr><tr><td>Double Door Chiller – Temperature Display & Probe</td><td>Inspect</td><td class=\"muted-cell\">Reading matches calibrated reference within ±2°C</td><td>Weekly</td><td class=\"muted-cell\">Calibrated reference thermometer</td></tr><tr><td>Triple Door Chiller – Door Gaskets (All Doors)</td><td>Clean</td><td class=\"muted-cell\">Free of food residue and condensation mould on each door</td><td>Weekly</td><td class=\"muted-cell\">Damp cloth + mild detergent</td></tr><tr><td>Triple Door Chiller – Condenser Coil & Fan</td><td>Clean</td><td class=\"muted-cell\">Free of dust/lint buildup, fan blades unobstructed</td><td>Weekly</td><td class=\"muted-cell\">Soft brush / vacuum</td></tr><tr><td>Triple Door Chiller – Door Hinges (All Doors)</td><td>Tighten</td><td class=\"muted-cell\">Each door closes flush with no sagging</td><td>Weekly</td><td class=\"muted-cell\">Screwdriver / spanner set</td></tr><tr><td>Deck Oven – Door Seal/Gasket</td><td>Clean</td><td class=\"muted-cell\">Free of carbon buildup, seal intact</td><td>Daily</td><td class=\"muted-cell\">Soft brush + degreaser</td></tr><tr><td>Deck Oven – Burner/Heating Element</td><td>Inspect</td><td class=\"muted-cell\">Even flame/heat colour, no soot accumulation</td><td>Daily</td><td class=\"muted-cell\">Visual inspection</td></tr><tr><td>Deck Oven – Hinge & Door Bolts</td><td>Tighten</td><td class=\"muted-cell\">No sag in door, hinges firm</td><td>Weekly</td><td class=\"muted-cell\">Allen key / spanner set</td></tr>\n          </tbody>\n        </table>\n      </div>\n      <p>Legend: Mark each day&rsquo;s box with <strong>OK</strong> if the standard is met, or <strong>NOT OK</strong> if a deviation is found. Any &ldquo;NOT OK&rdquo; entry must be logged immediately in the Centralised Maintenance & Defect Log (Template B).</p>\n      <h4>Template B: Centralised Maintenance & Defect Log</h4>\n      <p>Maintained by the Maintenance Manager. Consolidates every &ldquo;Not OK&rdquo; finding escalated from Template A across all machines and sites. Sample entries shown for format reference; replace with live data.</p>\n      <div class=\"checklist-table-wrap\" style=\"margin-bottom:16px;\">\n        <table class=\"checklist-table\">\n          <thead><tr><th>Defect ID</th><th>Machine / Asset ID</th><th>Risk / Criticality</th><th>Sign-off Status</th></tr></thead>\n          <tbody>\n            <tr><td>DEF-0001</td><td>Deck Oven &ndash; Konanakunte Cross</td><td><span class=\"risk-chip risk-critical\">Critical</span></td><td>Open</td></tr>\n            <tr><td>DEF-0002</td><td>Spiral Mixer &ndash; Jayanagar 4T</td><td>Non-Critical</td><td>Open</td></tr>\n            <tr><td>DEF-0003</td><td>Four Door Chiller &ndash; BTM Layout</td><td>Non-Critical</td><td>Open</td></tr>\n          </tbody>\n        </table>\n      </div>\n      <h4>Template C: Weekly Autonomous Maintenance (AM) Audit Report</h4>\n      <p>Conducted bi-weekly by the QC Executive on a randomly sampled machine. Scores feed directly into the governance KPIs in Section 3.3.</p>\n      <div class=\"checklist-table-wrap\" style=\"margin-bottom:16px;\">\n        <table class=\"checklist-table\">\n          <thead><tr><th>Audit Parameter</th><th>Description / What the Auditor Checks</th></tr></thead>\n          <tbody>\n            <tr><td>Machine Cleanliness</td><td class=\"muted-cell\">Visible cleanliness of machine body, surrounding floor area, and accessibility of all CLIT points; absence of product residue, dust, or grease buildup.</td></tr>\n            <tr><td>Lubrication Point Compliance</td><td class=\"muted-cell\">All colour-coded lubrication points serviced per the marked frequency; no dry or over-greased points found.</td></tr>\n            <tr><td>Adherence to CLIT Schedule</td><td class=\"muted-cell\">Daily/Weekly checklist (Template A) fully and contemporaneously filled &mdash; no batch-filled or back-dated entries.</td></tr>\n            <tr><td>Defect Logging Accuracy</td><td class=\"muted-cell\">All &ldquo;Not OK&rdquo; checklist entries correspond to an actual logged entry in the Centralised Defect Log (Template B); no unreported deviations found during spot-check.</td></tr>\n            <tr><td>Visual Control Integrity</td><td class=\"muted-cell\">Laminated checklists, colour-coded tags, and shadow boards present, legible, and correctly positioned at the machine.</td></tr>\n          </tbody>\n        </table>\n      </div>\n      <p><strong>5-Point Grading Framework</strong></p>\n      <div class=\"grading-grid\" style=\"margin-bottom:8px;\">\n        \n          <div class=\"grading-cell\">\n            <div class=\"grading-score\">1</div>\n            <div class=\"grading-label\">Critical failure</div>\n            <div class=\"grading-desc\">Zero compliance; operational escalation</div>\n          </div>\n          <div class=\"grading-cell\">\n            <div class=\"grading-score\">2</div>\n            <div class=\"grading-label\">Poor Condition</div>\n            <div class=\"grading-desc\">Significant system failures; fix within 48h</div>\n          </div>\n          <div class=\"grading-cell\">\n            <div class=\"grading-score\">3</div>\n            <div class=\"grading-label\">Acceptable Tier</div>\n            <div class=\"grading-desc\">Minor standard drift; resolve within 1 week</div>\n          </div>\n          <div class=\"grading-cell\">\n            <div class=\"grading-score\">4</div>\n            <div class=\"grading-label\">Good Standard</div>\n            <div class=\"grading-desc\">Operational compliance with isolated comments</div>\n          </div>\n          <div class=\"grading-cell\">\n            <div class=\"grading-score\">5</div>\n            <div class=\"grading-label\">Excellent Execution</div>\n            <div class=\"grading-desc\">Flawless systemic compliance, master line standard</div>\n          </div>\n      </div>"
  },
  {
    "tag": "Section 3",
    "title": "Governance & Reporting Hierarchy",
    "body": "\n      <p>CLIT succeeds or fails on governance discipline, not on the quality of the templates alone. This section defines a strict four-tier chain of custody &mdash; from the technician executing the routine on the floor to the Operations Manager governing the programme overall &mdash; with explicit accountability at every level. The structure is deliberately designed so that no single role can both execute and self-certify compliance, preventing &ldquo;pencil-whipping&rdquo; (the falsification of checklist entries without performing the underlying task).</p>\n      <h4>3.1 Ground Execution &mdash; Maintenance Technicians</h4>\n      <ul class=\"role-points\">\n        <li>Execute the Daily/Weekly CLIT Checklist (Template A) for every assigned machine within the time-boxed 15&ndash;20 minute window, at the scheduled point in the shift.</li>\n        <li>Mark each parameter honestly as OK or Not OK against the standard stated on the checklist &mdash; never pre-filled or back-dated.</li>\n        <li>Immediately log any Not OK finding into the Centralised Maintenance & Defect Log (Template B) before the shift ends; do not attempt unauthorised repairs.</li>\n        <li>Sign the laminated checklist at the end of each shift, taking personal accountability for the entries recorded.</li>\n        <li>Escalate verbally to the Maintenance Manager for any Critical-risk finding (e.g., burning smell, exposed wiring, gas leakage) immediately, regardless of logging status.</li>\n      </ul>\n      <h4>3.2 The Maintenance Manager &mdash; Execution Owner</h4>\n      <ul class=\"role-points\">\n        <li>Accountable for daily shift sign-off: reviewing and countersigning each machine&rsquo;s checklist at shift end, verifying entries are contemporaneous and complete.</li>\n        <li>Converts every Defect Log entry into a planned, resourced work order, assigning ownership and a realistic target completion date based on criticality.</li>\n        <li>Provides the resources (spares, tools, contracted services) required to close out logged defects within the timelines defined in Section 3.5.</li>\n        <li>Compiles and reports weekly compliance metrics &mdash; checklist completion rate, average defect closure time, and repeat-defect frequency &mdash; to the Operations Manager every week.</li>\n        <li>Owns the colour-coded visual control system (lubrication tags, shadow boards, red/yellow/green machine status tags) and ensures it remains current.</li>\n        <li><strong>KPI:</strong> % of scheduled CLIT checklists completed on time; average defect closure time (days); % of Critical defects closed within 48 hours.</li>\n      </ul>\n      <h4>3.3 The QC Executive &mdash; Independent Auditor</h4>\n      <ul class=\"role-points\">\n        <li>Acts as the objective referee of the CLIT system, structurally independent of the maintenance reporting line to avoid conflict of interest.</li>\n        <li>Conducts surprise bi-weekly spot-checks on a randomly selected sample of machines using the Weekly AM Audit Report (Template C).</li>\n        <li>Cross-verifies that checklist &ldquo;Not OK&rdquo; entries correspond to actual logged defects, directly testing for under-reporting or pencil-whipping.</li>\n        <li>Reports audit findings simultaneously and independently to both the Operations Manager and the Maintenance Manager &mdash; never to one party alone &mdash; to preserve transparency.</li>\n        <li>Escalates any pattern of falsified or systematically incomplete records directly to the Operations Manager as a governance breach, not a routine finding.</li>\n        <li><strong>KPI:</strong> number of audits completed per month against schedule; % of audited machines scoring 4 or above; number of discrepancies found between checklist and defect log.</li>\n      </ul>\n      <h4>3.4 The Operations Manager &mdash; Ultimate Governance</h4>\n      <ul class=\"role-points\">\n        <li>Reviews weekly compliance, defect, and audit data trends across all sites (Konanakunte Cross, Jayanagar 4T, BTM Layout, HSR Layout, Sarjapur, Whitefield, Kundapura) to identify systemic versus isolated issues.</li>\n        <li>Manages cross-functional friction between Maintenance and QC where audit findings are disputed, acting as final arbiter on classification of Critical versus Non-Critical defects in contested cases.</li>\n        <li>Allocates capital and operating budget for spares, tooling, and contracted repairs based on the trends and cost data emerging from the Defect Log.</li>\n        <li>Holds monthly governance reviews with the Maintenance Manager and QC Executive to assess programme health and approve any scope expansion (new machines, new sites).</li>\n        <li>Retains final accountability for reporting overall CLIT programme performance to the CEO and Project Sponsor.</li>\n      </ul>\n      <h4>3.5 Defect Closure Timelines by Criticality</h4>\n      <div class=\"checklist-table-wrap\">\n        <table class=\"checklist-table\">\n          <thead><tr><th>Criticality</th><th>Definition</th><th>Target Closure Time</th></tr></thead>\n          <tbody>\n            <tr><td><span class=\"risk-chip risk-critical\">Critical</span></td><td class=\"muted-cell\">Poses immediate food-safety, employee-safety, or total production-stoppage risk (e.g., gas leak, exposed live wiring, complete equipment failure)</td><td>Within 48 hours of logging; production halted on affected unit until resolved if safety is implicated</td></tr>\n            <tr><td>Non-Critical</td><td class=\"muted-cell\">Does not stop production or compromise safety, but if unaddressed will degrade into a Critical defect (e.g., minor lubrication lapse, loose non-structural fastener)</td><td>Within 7 calendar days of logging, scheduled into planned maintenance work order</td></tr>\n          </tbody>\n        </table>\n      </div>"
  }
];

export const GOVERNANCE_HTML = "\n    <div class=\"eyebrow\">Section 4B &middot; Standards Framework</div>\n    <h2 class=\"section-title\">Governance & Grading Reference</h2>\n    <p class=\"section-sub\">Tap any row below to expand it. Reference scoring rubric and the role-based responsibility flow underpinning the CLIT program.</p>\n\n    <details class=\"accordion-item\" open>\n      <summary>\n        <div class=\"acc-meta\">\n          <span class=\"acc-tag\">Reference</span>\n          <span>Grading Scale (Per Audit Parameter)</span>\n        </div>\n        <span class=\"acc-icon\">+</span>\n      </summary>\n      <div class=\"accordion-body\">\n        <div class=\"grading-grid\">\n          \n            <div class=\"grading-cell\">\n              <div class=\"grading-score\">1</div>\n              <div class=\"grading-label\">Critical failure</div>\n              <div class=\"grading-desc\">Zero compliance; operational escalation</div>\n            </div>\n            <div class=\"grading-cell\">\n              <div class=\"grading-score\">2</div>\n              <div class=\"grading-label\">Poor Condition</div>\n              <div class=\"grading-desc\">Significant system failures; fix within 48h</div>\n            </div>\n            <div class=\"grading-cell\">\n              <div class=\"grading-score\">3</div>\n              <div class=\"grading-label\">Acceptable Tier</div>\n              <div class=\"grading-desc\">Minor standard drift; resolve within 1 week</div>\n            </div>\n            <div class=\"grading-cell\">\n              <div class=\"grading-score\">4</div>\n              <div class=\"grading-label\">Good Standard</div>\n              <div class=\"grading-desc\">Operational compliance with isolated comments</div>\n            </div>\n            <div class=\"grading-cell\">\n              <div class=\"grading-score\">5</div>\n              <div class=\"grading-label\">Excellent Execution</div>\n              <div class=\"grading-desc\">Flawless systemic compliance, master line standard</div>\n            </div>\n        </div>\n      </div>\n    </details>\n\n    <details class=\"accordion-item\">\n      <summary>\n        <div class=\"acc-meta\">\n          <span class=\"acc-tag\">Tier 1 &middot; Field Execution</span>\n          <span>Technician</span>\n        </div>\n        <span class=\"acc-icon\">+</span>\n      </summary>\n      <div class=\"accordion-body\">\n        <ul class=\"role-points\">\n          <li>Performs daily/weekly CLIT checklist items per machine</li>\n          <li>Marks each parameter OK / Not OK with direct observation</li>\n          <li>Cannot edit defect logs, audits, or governance settings</li>\n        </ul>\n      </div>\n    </details>\n\n    <details class=\"accordion-item\">\n      <summary>\n        <div class=\"acc-meta\">\n          <span class=\"acc-tag\">Tier 2 &middot; Line Supervision</span>\n          <span>Maintenance Manager</span>\n        </div>\n        <span class=\"acc-icon\">+</span>\n      </summary>\n      <div class=\"accordion-body\">\n        <ul class=\"role-points\">\n          <li>Reviews overview dashboard for plant-wide compliance</li>\n          <li>Owns defect log: action plans, spares, and target closure</li>\n          <li>Validates checklist completion against shift schedule</li>\n        </ul>\n      </div>\n    </details>\n\n    <details class=\"accordion-item\">\n      <summary>\n        <div class=\"acc-meta\">\n          <span class=\"acc-tag\">Tier 3 &middot; Quality Verification</span>\n          <span>QC Executive</span>\n        </div>\n        <span class=\"acc-icon\">+</span>\n      </summary>\n      <div class=\"accordion-body\">\n        <ul class=\"role-points\">\n          <li>Conducts independent spot-audits against the grading scale</li>\n          <li>Cross-checks defect log integrity against audit findings</li>\n          <li>Maintains governance and visual standard documentation</li>\n        </ul>\n      </div>\n    </details>\n\n    <details class=\"accordion-item\">\n      <summary>\n        <div class=\"acc-meta\">\n          <span class=\"acc-tag\">Tier 4 &middot; Executive Oversight</span>\n          <span>QC Lead / Sponsor</span>\n        </div>\n        <span class=\"acc-icon\">+</span>\n      </summary>\n      <div class=\"accordion-body\">\n        <ul class=\"role-points\">\n          <li>Full visibility across Overview, CLIT Checklist, Defect Log, AM Audit, Governance, and Reports &amp; Analytics</li>\n          <li>Reviews aggregated analytics, audit performance index, and defect health tracking against closure targets</li>\n          <li>Does not have access to the Admin Console &mdash; cannot manage user accounts, roles, machinery, or system resets</li>\n        </ul>\n      </div>\n    </details>\n\n    <details class=\"accordion-item\">\n      <summary>\n        <div class=\"acc-meta\">\n          <span class=\"acc-tag\">Tier 5 &middot; System Administration</span>\n          <span>Super Admin</span>\n        </div>\n        <span class=\"acc-icon\">+</span>\n      </summary>\n      <div class=\"accordion-body\">\n        <ul class=\"role-points\">\n          <li>Sole role with access to the Admin Console &mdash; every tab above is visible, plus this exclusive layer</li>\n          <li>Manages the Identity &amp; RBAC Access Matrix: adds new user accounts, changes roles, and renames sign-in emails</li>\n          <li>Resets a user's password (forces a fresh \"set password\" prompt on their next sign-in) without ever being able to view an existing password</li>\n          <li>Removes user accounts from the registry &mdash; Super Admin accounts themselves are protected and cannot be deleted by anyone, including another Super Admin</li>\n          <li>Adds or removes custom machinery/asset templates (with their own checklist items) on the CLIT Checklist tab</li>\n          <li>Administers system resets (wipes in-progress checklist marks and the open defect log; preserves the user registry, the audit history, and the checklist history archive) and demo data seeding</li>\n        </ul>\n      </div>\n    </details>\n\n    <div class=\"kicker-box\">\n      <p><strong>Closure Targets:</strong> Critical defects must close within 48 hours of being logged; non-critical defects must close within 7 days. These targets feed directly into the Defect Health Tracker on the Reports & Analytics tab.</p>\n    </div>\n\n    <div class=\"kicker-box\">\n      <p><strong>Authentication:</strong> Every account signs in with an email and password. A first-time sign-in (or one following a Super Admin password reset) prompts the user to set a new password before entering the workspace &mdash; nobody, including the Super Admin, can ever view another user's existing password.</p>\n    </div>\n  ";

