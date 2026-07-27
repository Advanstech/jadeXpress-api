/**
 * Product class profiles for counter-facing Product Intelligence.
 *
 * The catalogue is mixed — vitamins & supplements, beauty/personal care,
 * OTC and Rx medicines, equipment and consumables. Each class needs a
 * different set of questions answered at the counter, so the guidance
 * sections (and the language used) are driven by these profiles rather
 * than assuming every item is a drug.
 */
import type { products } from '../../database/schema';

type Product = typeof products.$inferSelect;

export type GuidanceTone = 'neutral' | 'caution' | 'warning' | 'positive';

export interface GuidanceBlock {
  heading: string;
  body: string;
  tone: GuidanceTone;
}

export interface ProductSectionProfile {
  id: string;
  label: string;
  /** Instruction handed to the model for this section */
  prompt: string;
  /** Deterministic content used when no model is configured */
  fallbackBlocks: (product: Product) => GuidanceBlock[];
}

export interface ProductProfile {
  id: 'supplement' | 'beauty' | 'medicine' | 'equipment' | 'general';
  label: string;
  headlineLabel: string;
  headlinePrompt: string;
  fallbackHeadline: (product: Product) => string;
  disclaimer: string;
  sections: ProductSectionProfile[];
}

const formOf = (p: Product) => p.dosageForm ?? p.unit ?? 'item';
const strengthOf = (p: Product) => (p.strength ? ` (${p.strength})` : '');

const SUPPLEMENT_PROFILE: ProductProfile = {
  id: 'supplement',
  label: 'Vitamin & Supplement',
  headlineLabel: 'What it supports',
  headlinePrompt:
    'what wellness need this supplement supports and who typically buys it',
  fallbackHeadline: (p) =>
    `${p.name}${strengthOf(p)} is a ${formOf(p)} sold as a daily wellness supplement. Confirm what the customer is trying to address before recommending it, and check whether they already take a similar product.`,
  disclaimer:
    'Supplements are not a substitute for a balanced diet or medical treatment. Refer customers with ongoing symptoms to a pharmacist or clinician.',
  sections: [
    {
      id: 'usage',
      label: 'How to take',
      prompt:
        'practical intake guidance — typical adult serving, timing with food, and how long a course usually runs',
      fallbackBlocks: (p) => [
        {
          heading: 'TYPICAL SERVING',
          body: `Follow the serving size printed on the ${p.unit} label. Most adult supplements are taken once daily unless the pack states otherwise.`,
          tone: 'neutral',
        },
        {
          heading: 'BEST TIME TO TAKE',
          body: 'Advise taking it with food unless the label says otherwise — this reduces stomach upset and improves absorption for most formulations.',
          tone: 'neutral',
        },
        {
          heading: 'CHILDREN',
          body: 'Adult supplement servings are not suitable for children. Point customers to a paediatric formulation instead.',
          tone: 'caution',
        },
      ],
    },
    {
      id: 'safety',
      label: 'Safety',
      prompt:
        'who should avoid it, common interactions with medication, and any allergen considerations',
      fallbackBlocks: (p) => [
        {
          heading: 'CHECK EXISTING MEDICATION',
          body: 'Ask whether the customer is on prescription medication. Supplements can interact with blood thinners, thyroid medication and antibiotics.',
          tone: 'warning',
        },
        {
          heading: 'PREGNANCY & BREASTFEEDING',
          body: 'Pregnant or breastfeeding customers should confirm with a clinician before starting any new supplement.',
          tone: 'caution',
        },
        {
          heading: 'ALLERGENS',
          body:
            p.allergens && p.allergens.length > 0
              ? `Declared allergens: ${p.allergens.join(', ')}. Confirm with the customer before selling.`
              : 'No allergens recorded for this item. Read the pack to the customer if they report allergies.',
          tone: p.allergens && p.allergens.length > 0 ? 'warning' : 'neutral',
        },
      ],
    },
    {
      id: 'counselling',
      label: 'Counter talk',
      prompt:
        'what the counter staff should say and ask, plus sensible add-on suggestions',
      fallbackBlocks: () => [
        {
          heading: 'ASK FIRST',
          body: 'What are you hoping this helps with? Are you taking anything else right now? These two questions catch most problems.',
          tone: 'neutral',
        },
        {
          heading: 'SET EXPECTATIONS',
          body: 'Supplements usually take a few weeks of consistent use before any difference is noticed. Say so upfront to avoid returns.',
          tone: 'neutral',
        },
      ],
    },
    {
      id: 'storage',
      label: 'Storage',
      prompt: 'storage conditions and shelf-life handling in a warm humid climate',
      fallbackBlocks: (p) => [
        {
          heading: 'STORAGE',
          body:
            p.storageInstructions ??
            'Store below 25°C, away from direct sunlight and humidity. Ghana’s climate degrades poorly stored supplements quickly.',
          tone: 'neutral',
        },
        {
          heading: 'AFTER OPENING',
          body: 'Keep the cap tightly closed and leave any desiccant sachet inside the bottle.',
          tone: 'neutral',
        },
      ],
    },
  ],
};

const MEDICINE_PROFILE: ProductProfile = {
  id: 'medicine',
  label: 'Medicine',
  headlineLabel: 'Indications',
  headlinePrompt: 'what conditions or symptoms this medicine is indicated for',
  fallbackHeadline: (p) =>
    `${p.name}${strengthOf(p)} is supplied as a ${formOf(p)}. Confirm the customer's symptoms and current medication before dispensing, and read the pack insert for the approved indications.`,
  disclaimer:
    'This is counter guidance only, not a clinical decision. Refer to a pharmacist for dosing decisions, and to a clinician for diagnosis.',
  sections: [
    {
      id: 'dosage',
      label: 'Dosage',
      prompt:
        'dosing guidance split by adults, children and elderly where relevant',
      fallbackBlocks: (p) => [
        {
          heading: 'ADULTS',
          body: `Dose according to the pack insert for ${p.name}. Do not exceed the stated maximum in 24 hours.`,
          tone: 'neutral',
        },
        {
          heading: 'CHILDREN',
          body: 'Paediatric dosing is weight and age dependent. Refer to the pharmacist rather than estimating a dose.',
          tone: 'warning',
        },
        {
          heading: 'ELDERLY',
          body: 'Older customers may need a reduced dose and are more sensitive to side effects. Flag to the pharmacist if they take multiple medicines.',
          tone: 'caution',
        },
      ],
    },
    {
      id: 'safety',
      label: 'Safety',
      prompt:
        'contraindications, common side effects, and interactions to watch for',
      fallbackBlocks: (p) => [
        {
          heading: 'BEFORE DISPENSING',
          body: p.requiresPrescription
            ? 'This item requires a valid prescription. Do not release it without one and pharmacist sign-off.'
            : 'Ask about allergies, pregnancy, and any other medicines currently being taken.',
          tone: p.requiresPrescription ? 'warning' : 'caution',
        },
        {
          heading: 'KNOWN WARNINGS',
          body: p.warnings ?? 'Read the warnings printed on the pack to the customer if they are unsure.',
          tone: 'warning',
        },
        {
          heading: 'WHEN TO REFER',
          body: 'If symptoms have lasted more than a few days, are worsening, or involve a child under 6, refer to a clinician.',
          tone: 'caution',
        },
      ],
    },
    {
      id: 'counselling',
      label: 'Counselling',
      prompt: 'what to tell the customer as they leave the counter',
      fallbackBlocks: () => [
        {
          heading: 'COMPLETE THE COURSE',
          body: 'If a course length is stated, explain that stopping early can allow symptoms to return.',
          tone: 'neutral',
        },
        {
          heading: 'WHAT TO WATCH FOR',
          body: 'Tell the customer to stop and seek advice if they develop a rash, swelling or difficulty breathing.',
          tone: 'warning',
        },
      ],
    },
    {
      id: 'storage',
      label: 'Storage',
      prompt: 'storage and disposal guidance suitable for a warm humid climate',
      fallbackBlocks: (p) => [
        {
          heading: 'STORAGE',
          body: p.storageInstructions ?? 'Store below 25°C, away from moisture and direct sunlight. Keep out of reach of children.',
          tone: 'neutral',
        },
        {
          heading: 'EXPIRY',
          body: 'Check the batch expiry before handing over. Never dispense from an expired batch.',
          tone: 'warning',
        },
      ],
    },
  ],
};

const BEAUTY_PROFILE: ProductProfile = {
  id: 'beauty',
  label: 'Beauty & Personal Care',
  headlineLabel: 'What it does',
  headlinePrompt: 'what this product does for skin, hair or body and who it suits',
  fallbackHeadline: (p) =>
    `${p.name} is a personal care ${formOf(p)}. Confirm the customer's skin or hair type and whether they are already using an active product before recommending it.`,
  disclaimer:
    'Cosmetic guidance only. Persistent skin conditions should be referred to a pharmacist or dermatologist.',
  sections: [
    {
      id: 'usage',
      label: 'How to use',
      prompt: 'application routine, frequency and where it fits in a regimen',
      fallbackBlocks: () => [
        {
          heading: 'APPLICATION',
          body: 'Apply to clean, dry skin following the instructions on the pack. Introduce one new product at a time.',
          tone: 'neutral',
        },
        {
          heading: 'FREQUENCY',
          body: 'Start every other day if the product contains an active ingredient, then build up as tolerated.',
          tone: 'neutral',
        },
      ],
    },
    {
      id: 'safety',
      label: 'Skin safety',
      prompt: 'patch testing, sun sensitivity, and ingredient conflicts',
      fallbackBlocks: () => [
        {
          heading: 'PATCH TEST',
          body: 'Advise testing on a small area of the inner arm for 24 hours before full use.',
          tone: 'caution',
        },
        {
          heading: 'SUN SENSITIVITY',
          body: 'Exfoliating and brightening actives increase sun sensitivity. Recommend daily sunscreen alongside.',
          tone: 'warning',
        },
        {
          heading: 'AVOID MIXING',
          body: 'Ask what else they are using. Layering multiple strong actives is the most common cause of irritation.',
          tone: 'caution',
        },
      ],
    },
    {
      id: 'counselling',
      label: 'Counter talk',
      prompt: 'what to explain at the counter and sensible pairings',
      fallbackBlocks: () => [
        {
          heading: 'SET EXPECTATIONS',
          body: 'Visible results usually take 4 to 8 weeks of consistent use. Say so to avoid disappointed returns.',
          tone: 'neutral',
        },
        {
          heading: 'PAIRS WELL WITH',
          body: 'A gentle cleanser and a daily sunscreen are the two most useful add-ons for almost any regimen.',
          tone: 'positive',
        },
      ],
    },
    {
      id: 'storage',
      label: 'Storage',
      prompt: 'storage and shelf life after opening',
      fallbackBlocks: (p) => [
        {
          heading: 'STORAGE',
          body: p.storageInstructions ?? 'Keep the cap closed and store away from direct heat and sunlight.',
          tone: 'neutral',
        },
        {
          heading: 'AFTER OPENING',
          body: 'Check the period-after-opening symbol on the pack — most items are good for 6 to 12 months once opened.',
          tone: 'neutral',
        },
      ],
    },
  ],
};

const EQUIPMENT_PROFILE: ProductProfile = {
  id: 'equipment',
  label: 'Equipment & Consumable',
  headlineLabel: 'What it is for',
  headlinePrompt: 'what this device or consumable is used for and who needs it',
  fallbackHeadline: (p) =>
    `${p.name} is a ${formOf(p)} stocked for practical use rather than ingestion. Confirm the customer knows how to use it correctly before selling.`,
  disclaimer: 'Guidance only. Direct clinical use questions to a pharmacist.',
  sections: [
    {
      id: 'usage',
      label: 'How to use',
      prompt: 'setup, correct use and common mistakes',
      fallbackBlocks: () => [
        {
          heading: 'BEFORE FIRST USE',
          body: 'Walk the customer through the instruction leaflet. Most complaints come from incorrect first use.',
          tone: 'neutral',
        },
        {
          heading: 'COMMON MISTAKE',
          body: 'Confirm they understand any single-use versus reusable distinction before they leave the counter.',
          tone: 'caution',
        },
      ],
    },
    {
      id: 'safety',
      label: 'Safety',
      prompt: 'hygiene, single-use rules and disposal',
      fallbackBlocks: () => [
        {
          heading: 'HYGIENE',
          body: 'Single-use items must never be reused. Reusable items need cleaning per the manufacturer instructions.',
          tone: 'warning',
        },
        {
          heading: 'DISPOSAL',
          body: 'Sharps and contaminated consumables need proper disposal — do not put them in household waste.',
          tone: 'warning',
        },
      ],
    },
    {
      id: 'counselling',
      label: 'Counter talk',
      prompt: 'what to check with the customer and useful add-ons',
      fallbackBlocks: () => [
        {
          heading: 'CHECK COMPATIBILITY',
          body: 'Confirm sizing, fit or compatibility with any device the customer already owns before completing the sale.',
          tone: 'caution',
        },
        {
          heading: 'ADD-ONS',
          body: 'Ask whether they need refills, replacement parts or batteries at the same time.',
          tone: 'positive',
        },
      ],
    },
    {
      id: 'storage',
      label: 'Storage',
      prompt: 'storage and care',
      fallbackBlocks: (p) => [
        {
          heading: 'STORAGE',
          body: p.storageInstructions ?? 'Store dry and away from direct heat. Keep sterile packaging sealed until use.',
          tone: 'neutral',
        },
      ],
    },
  ],
};

const GENERAL_PROFILE: ProductProfile = {
  id: 'general',
  label: 'General Stock',
  headlineLabel: 'Overview',
  headlinePrompt: 'a short practical description of the item for counter staff',
  fallbackHeadline: (p) =>
    `${p.name} is stocked as general inventory. ${p.description ?? 'No extended description recorded — add one in Inventory to improve this guidance.'}`,
  disclaimer: 'General guidance only.',
  sections: [
    {
      id: 'usage',
      label: 'How to use',
      prompt: 'practical usage guidance for the customer',
      fallbackBlocks: () => [
        {
          heading: 'USAGE',
          body: 'Follow the instructions printed on the pack.',
          tone: 'neutral',
        },
      ],
    },
    {
      id: 'counselling',
      label: 'Counter talk',
      prompt: 'what to confirm with the customer before completing the sale',
      fallbackBlocks: () => [
        {
          heading: 'CONFIRM FIT',
          body: 'Check the item matches what the customer actually asked for before completing the sale.',
          tone: 'neutral',
        },
      ],
    },
  ],
};

const PROFILES_BY_TYPE: Record<string, ProductProfile> = {
  supplement: SUPPLEMENT_PROFILE,
  beauty: BEAUTY_PROFILE,
  otc_medicine: MEDICINE_PROFILE,
  rx_medicine: MEDICINE_PROFILE,
  equipment: EQUIPMENT_PROFILE,
  consumable: EQUIPMENT_PROFILE,
};

const CATEGORY_HINTS: Array<{ pattern: RegExp; profile: ProductProfile }> = [
  { pattern: /vitamin|supplement|mineral|herbal|wellness|nutrition/i, profile: SUPPLEMENT_PROFILE },
  { pattern: /antibiotic|antimalarial|analgesic|medicine|drug|pharma|cardio|otc|rx/i, profile: MEDICINE_PROFILE },
  { pattern: /beauty|skin|hair|cosmetic|personal care|serum|lotion|cream/i, profile: BEAUTY_PROFILE },
  { pattern: /equipment|device|consumable|first aid|dressing|syringe/i, profile: EQUIPMENT_PROFILE },
];

/**
 * Resolves the guidance profile for a product. The stored product `type` is
 * authoritative; the category name is only used as a hint when the type is
 * still sitting on the schema default.
 */
export function resolveProductProfile(
  type?: string | null,
  categoryName?: string | null,
): ProductProfile {
  const isDefaultType = !type || type === 'supplement';

  if (categoryName && isDefaultType) {
    const hint = CATEGORY_HINTS.find((h) => h.pattern.test(categoryName));
    if (hint) return hint.profile;
  }

  return (type && PROFILES_BY_TYPE[type]) || GENERAL_PROFILE;
}
