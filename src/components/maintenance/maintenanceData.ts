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
  ["Document Title", "SOP & Governance Framework: Autonomous Maintenance (CLIT)"],
  ["Applicable Framework", "5S · Total Productive Maintenance (TPM) · Six Sigma DMAIC · FSSAI Compliance"],
  ["Document Status", "Implementation-Ready · Version 1.0"]
];

export const SOP_CHAPTERS = [
  {
    tag: "Section 1",
    title: "Introduction & Operational Philosophy",
    body: `
      <h4>From reactive to proactive</h4>
      <p>Equipment care moves from a reactive &ldquo;fix it when it breaks&rdquo; model to Autonomous Maintenance under the CLIT discipline &mdash; Clean, Lubricate, Inspect, Tighten &mdash; embedded within 5S. The operator or assigned technician performs small, frequent, standardised checks that catch wear and irregularities long before they become breakdowns. This is the first line of defence that feeds early warnings into planned maintenance via the Defect Log.</p>
      <p>Three risks this addresses in any food or production operation: unplanned stoppages during peak windows, inconsistent quality from poorly kept equipment, and food-safety exposure from neglected refrigeration.</p>
      <h4>Time-boxed: 15&ndash;20 minutes</h4>
      <ul class="role-points">
        <li><strong>Fixed scope:</strong> each machine&rsquo;s checklist lists only the components that matter &mdash; no open-ended &ldquo;inspect everything&rdquo;.</li>
        <li><strong>Fixed slot:</strong> CLIT is scheduled into the shift like any production task, not squeezed in.</li>
        <li><strong>Escalate, don&rsquo;t repair:</strong> anything beyond clean / lubricate / inspect / tighten is logged in the Defect Log and handed off &mdash; technicians do not attempt repairs during the round.</li>
      </ul>
      <h4>Visual controls on the floor</h4>
      <ul class="role-points">
        <li>Colour-coded lubrication points (for example red = daily, yellow = weekly, green = monthly).</li>
        <li>A laminated, wipe-clean checklist mounted at each machine and marked every shift.</li>
        <li>Red / yellow / green status tags for one-glance machine status.</li>
        <li>Shadow boards so CLIT tools are always to hand and the time-box is never lost searching.</li>
      </ul>`
  },
  {
    tag: "Section 2",
    title: "The CLIT Templates",
    body: `
      <p>The programme runs on three simple tools designed for use directly on the floor.</p>
      <h4>A &middot; Machine-side checklist (Daily / Weekly / Monthly)</h4>
      <p>One checklist per machine, grouped by frequency. The technician marks each item <strong>OK</strong> or <strong>Not OK</strong> against the stated standard and submits the round. Any &ldquo;Not OK&rdquo; is raised automatically in the Defect Log.</p>
      <h4>B &middot; Centralised Defect Log</h4>
      <p>Every &ldquo;Not OK&rdquo; becomes a tracked defect with a risk level, an action plan, the spares needed and a target close date. The Maintenance Manager converts each into a resourced work order.</p>
      <h4>C &middot; Weekly AM Audit</h4>
      <p>An independent QC auditor spot-checks a sampled machine against five parameters, scoring each 1&ndash;5. Scores feed the Reports tab. Auditing is kept structurally separate from running the checklist, so no one certifies their own work.</p>`
  }
];

export const SOP_GOVERNANCE = `
  <p>CLIT succeeds on governance discipline, not on templates alone. Responsibilities are split so that no single role both runs and certifies the checks &mdash; preventing back-filled or falsified entries.</p>
  <h4>Roles &amp; responsibilities</h4>
  <ul class="role-points">
    <li><strong>Technician</strong> &mdash; runs the Daily / Weekly / Monthly checks, marks OK / Not OK honestly, and logs every &ldquo;Not OK&rdquo; before shift end. Does not attempt repairs.</li>
    <li><strong>Maintenance Manager</strong> &mdash; owns the Defect Log, converts findings into work orders with owners and target dates, and keeps the equipment registry and visual controls current.</li>
    <li><strong>QC Executive / QC Lead</strong> &mdash; independent auditor; spot-checks machines, verifies that &ldquo;Not OK&rdquo; marks match logged defects, and reports findings independently.</li>
    <li><strong>CLIT Admin</strong> &mdash; grants CLIT access and roles, manages the machine registry, and administers system resets.</li>
  </ul>
  <h4>Grading scale (per audit parameter)</h4>
  <div class="grading-grid" style="margin-bottom:8px;">
    <div class="grading-cell"><div class="grading-score">1</div><div class="grading-label">Critical failure</div><div class="grading-desc">Zero compliance; escalate</div></div>
    <div class="grading-cell"><div class="grading-score">2</div><div class="grading-label">Poor</div><div class="grading-desc">Significant gaps; fix within 48h</div></div>
    <div class="grading-cell"><div class="grading-score">3</div><div class="grading-label">Acceptable</div><div class="grading-desc">Minor drift; resolve within a week</div></div>
    <div class="grading-cell"><div class="grading-score">4</div><div class="grading-label">Good</div><div class="grading-desc">Compliant, isolated comments</div></div>
    <div class="grading-cell"><div class="grading-score">5</div><div class="grading-label">Excellent</div><div class="grading-desc">Flawless, master-line standard</div></div>
  </div>
  <h4>Defect closure targets</h4>
  <div class="checklist-table-wrap">
    <table class="checklist-table">
      <thead><tr><th>Criticality</th><th>Definition</th><th>Target closure</th></tr></thead>
      <tbody>
        <tr><td><span class="risk-chip risk-critical">Critical</span></td><td class="muted-cell">Immediate food-safety, employee-safety, or full-stoppage risk.</td><td>Within 48 hours; halt the affected unit if safety is implicated.</td></tr>
        <tr><td>Non-Critical</td><td class="muted-cell">No immediate stoppage or safety risk, but will worsen if ignored.</td><td>Within 7 days, scheduled into planned maintenance.</td></tr>
      </tbody>
    </table>
  </div>
`;
