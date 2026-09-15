export type BankruptcySource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
};

export type BankruptcyQuestion = {
  id: number;
  category: string;
  question: string;
  answer: string;
  sourceIds: string[];
};

export const bankruptcyReviewedAt = "2026-08-16";

export const bankruptcySources: BankruptcySource[] = [
  { id: "basics", title: "Bankruptcy Basics", publisher: "U.S. Courts", url: "https://www.uscourts.gov/court-programs/bankruptcy/bankruptcy-basics" },
  { id: "process", title: "Process — Bankruptcy Basics", publisher: "U.S. Courts", url: "https://www.uscourts.gov/court-programs/bankruptcy/bankruptcy-basics/process-bankruptcy-basics" },
  { id: "chapter7", title: "Chapter 7 — Liquidation", publisher: "U.S. Courts", url: "https://www.uscourts.gov/court-programs/bankruptcy/bankruptcy-basics/chapter-7-bankruptcy-basics" },
  { id: "chapter11", title: "Chapter 11 — Reorganization", publisher: "U.S. Courts", url: "https://www.uscourts.gov/court-programs/bankruptcy/bankruptcy-basics/chapter-11-bankruptcy-basics" },
  { id: "chapter12", title: "Chapter 12 — Family Farmers and Fishermen", publisher: "U.S. Courts", url: "https://www.uscourts.gov/court-programs/bankruptcy/bankruptcy-basics/chapter-12-bankruptcy-basics" },
  { id: "chapter13", title: "Chapter 13 — Individual Debt Adjustment", publisher: "U.S. Courts", url: "https://www.uscourts.gov/court-programs/bankruptcy/bankruptcy-basics/chapter-13-bankruptcy-basics" },
  { id: "discharge", title: "Discharge in Bankruptcy", publisher: "U.S. Courts", url: "https://www.uscourts.gov/court-programs/bankruptcy/bankruptcy-basics/discharge-bankruptcy-bankruptcy-basics" },
  { id: "forms", title: "Official Bankruptcy Forms", publisher: "U.S. Courts", url: "https://www.uscourts.gov/forms-rules/forms/bankruptcy-forms" },
  { id: "prose", title: "Filing Without an Attorney", publisher: "U.S. Courts", url: "https://www.uscourts.gov/court-programs/bankruptcy/filing-without-attorney" },
  { id: "fees", title: "Bankruptcy Court Fee Schedule", publisher: "U.S. Courts", url: "https://www.uscourts.gov/court-programs/fees/bankruptcy-court-miscellaneous-fee-schedule" },
  { id: "means", title: "Means Testing", publisher: "U.S. Trustee Program", url: "https://www.justice.gov/ust/means-testing" },
  { id: "counseling", title: "Credit Counseling and Debtor Education", publisher: "U.S. Trustee Program", url: "https://www.justice.gov/ust/credit-counseling-and-debtor-education-providers" },
  { id: "student", title: "Student Loan Guidance", publisher: "U.S. Trustee Program", url: "https://www.justice.gov/ust/student-loan-guidance" },
  { id: "fraud", title: "Report Suspected Bankruptcy Fraud", publisher: "U.S. Trustee Program", url: "https://www.justice.gov/ust/report-suspected-bankruptcy-fraud" },
  { id: "tax", title: "Publication 908: Bankruptcy Tax Guide", publisher: "Internal Revenue Service", url: "https://www.irs.gov/publications/p908" },
  { id: "credit", title: "How long bankruptcy appears on credit reports", publisher: "Consumer Financial Protection Bureau", url: "https://www.consumerfinance.gov/ask-cfpb/how-long-does-a-bankruptcy-appear-on-credit-reports-en-325/" },
  { id: "alternatives", title: "How To Get Out of Debt", publisher: "Federal Trade Commission", url: "https://consumer.ftc.gov/articles/how-get-out-debt" },
  { id: "code", title: "Title 11 — Bankruptcy", publisher: "U.S. House Office of the Law Revision Counsel", url: "https://uscode.house.gov/view.xhtml?path=/prelim@title11&edition=prelim" },
];

type Draft = [question: string, answer: string, sourceIds: string[]];

const groups: { category: string; items: Draft[] }[] = [
  {
    category: "Basic Concepts & Types",
    items: [
      ["What is bankruptcy?", "Bankruptcy is a federal court process for dealing with debts that a person or entity cannot pay. Depending on the chapter, it can liquidate non-exempt assets, reorganize obligations, or establish a repayment plan; it does not erase every debt or every lien.", ["basics", "process"]],
      ["What are the main types of bankruptcy in the United States?", "The chapters most people encounter are Chapter 7 liquidation, Chapter 11 reorganization, Chapter 12 for qualifying family farmers or family fishermen, and Chapter 13 repayment for individuals with regular income. Chapters 9 and 15 address municipalities and cross-border cases.", ["basics"]],
      ["What is Chapter 7 bankruptcy?", "Chapter 7 is liquidation. A trustee collects and may sell non-exempt estate property, then distributes proceeds under statutory priorities; an eligible individual may receive a discharge of many remaining debts.", ["chapter7"]],
      ["What is Chapter 11 bankruptcy?", "Chapter 11 is primarily a reorganization chapter used by businesses and sometimes individuals. The debtor commonly remains in possession, operates under fiduciary duties, and seeks confirmation of a plan that restructures claims.", ["chapter11"]],
      ["What is Chapter 13 bankruptcy?", "Chapter 13 lets an eligible individual with regular income propose a court-approved plan, usually lasting three to five years. The trustee receives plan payments and distributes them to creditors.", ["chapter13"]],
      ["What is Chapter 12 bankruptcy and who can use it?", "Chapter 12 is a streamlined repayment chapter for qualifying family farmers and family fishermen with regular annual income. Detailed debt, income and activity tests determine eligibility.", ["chapter12"]],
      ["What is the difference between liquidation and reorganization bankruptcy?", "Liquidation converts non-exempt estate assets into money for creditors, while reorganization preserves some operations or property and adjusts debts through a plan. Chapter 7 is the standard liquidation chapter; Chapters 11, 12 and 13 are plan-based.", ["process"]],
      ["What does “automatic stay” mean in bankruptcy?", "Filing usually triggers a statutory pause on many collection actions, lawsuits, garnishments, foreclosures and repossessions. Important exceptions apply, and a creditor can ask the court for relief from the stay.", ["process", "code"]],
      ["What is a bankruptcy discharge?", "A discharge is a court order releasing the debtor from personal liability for specified debts and prohibiting collection of those discharged debts. It generally does not eliminate a valid lien that was not avoided in the case.", ["discharge"]],
      ["What debts can typically be discharged in bankruptcy?", "Many general unsecured debts—such as credit-card balances, medical bills and unsecured personal loans—may be discharged, subject to the chapter, facts and any successful creditor objection. The discharge applies to personal liability, not automatically to surviving liens.", ["discharge"]],
      ["What debts usually cannot be discharged?", "Common exceptions include domestic-support obligations, many taxes, most government-backed student loans absent undue hardship, criminal fines or restitution, and certain debts caused by fraud, intoxicated driving or willful and malicious injury. The exact list varies by chapter.", ["chapter7", "discharge"]],
      ["What is the means test in Chapter 7?", "The means test uses income and allowed-expense data to determine whether a presumption of abuse arises for an individual with primarily consumer debt. Current figures depend on filing date, state and household size; the U.S. Trustee Program publishes the operative data.", ["means"]],
      ["Who can file for bankruptcy?", "Individuals and various business entities can be debtors, but eligibility differs by chapter. Residence, domicile, place of business or property in the United States, prior dismissals, counseling, debt limits and entity type can all matter.", ["basics", "code"]],
      ["Can a business file for bankruptcy?", "Yes. A business may liquidate under Chapter 7 or reorganize under Chapter 11; qualifying small businesses may elect Subchapter V. A sole proprietor may also have individual Chapter 13 options because the business is not a separate legal person.", ["chapter7", "chapter11"]],
      ["Can an individual file for bankruptcy more than once?", "Yes, but repeat filings can affect the automatic stay and the availability or timing of a new discharge. Waiting periods depend on the earlier chapter, the new chapter, filing dates and whether a discharge was entered.", ["discharge", "code"]],
    ],
  },
  {
    category: "Eligibility & Filing Process",
    items: [
      ["What documents are needed to file for bankruptcy?", "An individual filing normally submits a petition, creditor matrix, schedules of assets, debts, income, expenses, contracts and codebtors, a statement of financial affairs, means-test forms where applicable, and counseling evidence. Local courts may require additional forms.", ["forms", "prose"]],
      ["How much does it cost to file for bankruptcy?", "As reviewed on 16 August 2026, standard petition fees are $338 for Chapter 7, $1,738 for Chapter 11, $278 for Chapter 12 and $313 for Chapter 13. Fees can change; qualifying individuals may seek installments, and some Chapter 7 filers may seek a waiver.", ["fees", "forms"]],
      ["Do I need a lawyer to file for bankruptcy?", "An individual may file without counsel, but U.S. Courts strongly recommends qualified legal advice because errors can affect property, discharge and procedural rights. Corporations and other entities generally must appear through counsel under applicable court rules.", ["prose"]],
      ["What is credit counseling and is it required before filing?", "With limited statutory exceptions, an individual must receive a briefing from an approved credit-counseling organization during the 180 days before filing. The certificate is filed with the court; use the current government-approved provider list.", ["counseling"]],
      ["What is a debtor education course?", "It is a post-filing personal financial-management course required for most individual debtors to receive a discharge. It is separate from pre-filing credit counseling and must come from an approved provider.", ["counseling", "discharge"]],
      ["How long does a typical Chapter 7 case take?", "A straightforward individual Chapter 7 case often reaches discharge about four months after filing, although administration may continue if assets must be sold or litigation occurs. Objections, audits or missing documents can extend the case.", ["chapter7", "discharge"]],
      ["How long does a typical Chapter 13 case last?", "Chapter 13 plans usually run three or five years. Income and statutory commitment-period rules influence duration, and the case may end earlier through dismissal, conversion or approved payoff in limited circumstances.", ["chapter13", "means"]],
      ["What is a bankruptcy petition?", "The petition is the document that formally asks the bankruptcy court for relief under a specified chapter. Filing it commences the case and usually triggers the automatic stay.", ["process", "forms"]],
      ["What is the role of the bankruptcy trustee?", "The role depends on the chapter. A Chapter 7 trustee administers estate assets and claims; a Chapter 13 trustee reviews the plan and distributes payments; a Subchapter V trustee helps facilitate reorganization and monitors performance.", ["chapter7", "chapter11", "chapter13"]],
      ["What happens at the 341 meeting of creditors?", "The debtor answers questions under oath from the trustee about finances, property and filings. Creditors may attend and ask relevant questions; the bankruptcy judge does not preside.", ["process"]],
      ["Can creditors object to a bankruptcy discharge?", "Yes. A creditor or trustee may timely bring an objection to the debtor’s overall discharge or seek a ruling that a particular debt is nondischargeable. Grounds and deadlines are governed by the Code and Bankruptcy Rules.", ["discharge", "code"]],
      ["What is preferential treatment of creditors?", "A preference is generally a qualifying pre-bankruptcy transfer that lets one creditor receive more than it would in the bankruptcy distribution. A trustee may recover certain payments made within 90 days before filing, or within one year for insiders, subject to defenses.", ["chapter7", "code"]],
      ["What is a fraudulent transfer in bankruptcy?", "It is a transfer made with actual intent to hinder, delay or defraud creditors, or in some cases for less than reasonably equivalent value while financially distressed. A trustee may avoid the transfer, and concealment can jeopardize discharge or create criminal exposure.", ["code", "fraud"]],
      ["Can I keep my house in bankruptcy?", "Possibly. The result depends on equity, applicable exemptions, liens, payment status and chapter. Chapter 13 may permit cure of mortgage arrears, while a Chapter 7 trustee may sell property with meaningful non-exempt equity.", ["chapter7", "chapter13"]],
      ["Can I keep my car in bankruptcy?", "Possibly. Equity, exemptions, loan status and chapter matter. A Chapter 7 debtor may surrender, redeem or reaffirm in appropriate circumstances; Chapter 13 can treat the secured claim through the plan.", ["chapter7", "chapter13"]],
    ],
  },
  {
    category: "Assets, Exemptions & Property",
    items: [
      ["What are bankruptcy exemptions?", "Exemptions remove specified property or value from distribution to unsecured creditors. They protect property only up to applicable limits and do not automatically defeat a valid mortgage, vehicle lien or other secured interest.", ["chapter7", "code"]],
      ["What is the difference between federal and state exemptions?", "The Bankruptcy Code provides a federal exemption set, but states may require residents to use state exemptions or allow a choice. Domicile rules determine which regime applies; exemption amounts and protected property vary significantly.", ["chapter7", "code"]],
      ["What is homestead exemption?", "A homestead exemption protects a specified amount of equity in a qualifying principal residence. Its amount, acreage, ownership and occupancy rules come from applicable federal or state law and may be affected by bankruptcy-specific caps.", ["chapter7", "code"]],
      ["Can I protect retirement accounts in bankruptcy?", "Many tax-qualified retirement plans and certain retirement funds receive strong federal protection, but account type, contributions, rollovers and statutory limits matter. A lawyer should classify each account before filing.", ["code", "chapter7"]],
      ["What happens to jointly owned property?", "The debtor’s legal and equitable interests become relevant to the estate even when property is jointly titled. State ownership law, exemptions, liens and the non-filing co-owner’s interest determine whether the trustee can administer or seek sale of the property.", ["chapter7", "code"]],
      ["What is reaffirmation of a debt?", "A reaffirmation is a new agreement that makes an otherwise dischargeable debt remain personally enforceable, commonly for secured property. It must satisfy disclosure and timing rules, and the court may review undue hardship.", ["chapter7", "forms"]],
      ["What is redemption of property in Chapter 7?", "Redemption allows an individual debtor to keep certain personal property by paying the secured creditor the property’s allowed secured value in a lump sum. Eligibility and valuation disputes are governed by the Code and court procedure.", ["chapter7", "code"]],
      ["Can the trustee sell my non-exempt property?", "Yes. In Chapter 7, the trustee can sell estate property that is not fully protected, provided the sale benefits the estate after liens, exemptions and costs. Trustees may abandon property that has inconsequential value to the estate.", ["chapter7"]],
      ["What happens to my tax refunds during bankruptcy?", "A refund attributable to a pre-filing tax period may be estate property, even if received later; exemptions and allocation across the filing date can matter. The IRS may also freeze or offset some refunds under rules described in Publication 908.", ["tax", "chapter7"]],
      ["Are inheritance or lawsuit settlements considered assets?", "Yes, potential and pending claims must be disclosed, and some inheritances acquired within 180 days after filing enter the estate. Chapter 13 also reaches certain property acquired during the case and may require plan modification.", ["code", "chapter13"]],
    ],
  },
  {
    category: "Debts & Creditors",
    items: [
      ["What happens to secured debts in bankruptcy?", "A discharge may remove personal liability, but a valid lien usually survives unless avoided or treated under a confirmed plan. The debtor may surrender collateral, cure or pay through a plan, redeem, or reaffirm depending on the chapter and asset.", ["discharge", "chapter13"]],
      ["What happens to unsecured debts?", "Allowed unsecured claims share in distributions according to statutory priority and the chapter’s rules. General unsecured balances may receive little or nothing in Chapter 7 and may be paid partly through a plan before the remainder is discharged.", ["chapter7", "chapter13"]],
      ["How are priority debts treated?", "Priority claims—such as certain taxes, domestic-support obligations and administrative expenses—are paid ahead of general unsecured claims. Plan chapters generally require specified priority treatment before confirmation or discharge.", ["chapter13", "code"]],
      ["Are student loans dischargeable?", "They can be, but most covered educational debts require a separate adversary proceeding and proof that repayment would impose undue hardship. DOJ and Education use a standardized process to evaluate federal-loan discharge requests.", ["student", "discharge"]],
      ["Can tax debts be discharged?", "Some older income-tax debts may be dischargeable if multiple timing, filing and conduct requirements are met. Recent priority taxes, unfiled or fraudulent-return liabilities, trust-fund taxes and liens often survive; Publication 908 is the starting official guide.", ["tax"]],
      ["What happens to alimony and child support?", "Domestic-support obligations are not discharged. Collection may continue in circumstances permitted by the stay exceptions, and Chapter 13 discharge requires required post-petition support payments to be current.", ["chapter13", "discharge"]],
      ["Can I include medical bills in bankruptcy?", "Yes. Ordinary unsecured medical bills are listed and are commonly dischargeable unless a specific exception applies. Include all creditors and do not omit a bill merely because insurance or responsibility is disputed.", ["forms", "discharge"]],
      ["What happens to credit card debt?", "Ordinary credit-card debt is generally unsecured and may be discharged. Charges obtained through fraud, and certain luxury purchases or cash advances close to filing, can be challenged as nondischargeable.", ["chapter7", "discharge"]],
      ["Can co-signers be affected by my bankruptcy?", "Yes. Your discharge normally does not erase a co-signer’s liability. Chapter 13 has a limited consumer co-debtor stay, but it can end or be lifted, and the plan’s treatment affects the co-signer’s exposure.", ["chapter13", "discharge"]],
      ["What is a proof of claim?", "A proof of claim is a creditor’s filed statement of the amount and basis of a claim, with supporting information. Filing deadlines, objections and whether a claim must be filed vary by chapter and creditor type.", ["forms", "process"]],
    ],
  },
  {
    category: "Chapter 13 Specific",
    items: [
      ["How does a Chapter 13 repayment plan work?", "The debtor proposes regular payments to a Chapter 13 trustee, who distributes funds under the confirmed plan. The plan classifies claims, cures or maintains some secured debts, pays required priorities and provides a dividend to unsecured creditors.", ["chapter13"]],
      ["How is the plan payment calculated?", "The payment must make the plan feasible and satisfy treatment rules for secured and priority claims, the best-interests test, and projected disposable-income requirements where applicable. Local practice and trustee guidelines also shape the number.", ["chapter13", "means"]],
      ["Can I modify a Chapter 13 plan after confirmation?", "Yes, in qualifying circumstances. The debtor, trustee or an unsecured creditor may seek modification to change payments, duration or distributions, subject to statutory limits and court approval.", ["chapter13", "code"]],
      ["What happens if I miss plan payments?", "The trustee or a creditor may seek dismissal, conversion or other relief. Promptly raising a temporary income problem may allow a modification, cure or other court-approved solution, but none is automatic.", ["chapter13"]],
      ["Can I convert from Chapter 13 to Chapter 7?", "A Chapter 13 debtor generally has a right to convert to Chapter 7 if eligible, but conversion changes control of property, discharge rules and creditor remedies. Bad faith or previous conversion can create additional issues.", ["chapter13", "code"]],
      ["What is a hardship discharge in Chapter 13?", "It is a limited discharge available when failure to complete payments results from circumstances for which the debtor should not justly be held accountable, creditors received at least Chapter 7 liquidation value, and plan modification is not practicable.", ["chapter13", "tax"]],
      ["How does Chapter 13 help with mortgage arrears?", "A plan can generally cure pre-filing arrears over time while the debtor maintains ongoing mortgage payments. It does not guarantee retention if the plan is infeasible or post-filing payments are missed.", ["chapter13"]],
      ["Can I strip a second mortgage in Chapter 13?", "A wholly unsecured junior lien may sometimes be treated as unsecured and avoided after plan completion, depending on property value and controlling circuit law. A partially secured home mortgage receives different anti-modification protection.", ["chapter13", "code"]],
      ["What is the disposable income test in Chapter 13?", "If the trustee or an unsecured creditor objects, the plan generally must devote projected disposable income to unsecured creditors during the applicable commitment period. Means-test forms supply a starting point for many above-median-income debtors.", ["means", "chapter13"]],
      ["How long must I stay in a Chapter 13 plan?", "Usually three years for a below-median debtor and five years for an above-median debtor, unless allowed unsecured claims are paid in full sooner. The court may approve modifications, but the statutory maximum is generally five years.", ["chapter13", "means"]],
    ],
  },
  {
    category: "Chapter 11 & Business Bankruptcy",
    items: [
      ["Who typically files Chapter 11?", "Corporations, partnerships and other businesses most commonly use Chapter 11, but individuals can qualify too. It is appropriate when value may be preserved through continued operation, a going-concern sale or a negotiated restructuring.", ["chapter11"]],
      ["What is a debtor-in-possession?", "It is the Chapter 11 debtor that remains in control of estate property and business operations while exercising many trustee powers. It acts as a fiduciary and is monitored by the U.S. Trustee and the court.", ["chapter11"]],
      ["What is a plan of reorganization?", "The plan specifies how claims and ownership interests will be classified and treated and how the reorganized debtor will be funded and governed. Confirmation makes an approved plan binding on the debtor and affected parties.", ["chapter11"]],
      ["What is the absolute priority rule?", "In a non-consensual Chapter 11 confirmation, a junior class generally cannot receive or retain property on account of its interest unless senior dissenting unsecured classes are paid in full. Subchapter V modifies how this rule operates.", ["chapter11", "code"]],
      ["Can small businesses use Subchapter V of Chapter 11?", "Yes, if they satisfy the current statutory definition and debt limit and elect Subchapter V. It uses a trustee, accelerated deadlines and a more streamlined confirmation structure; current eligibility limits must be checked on the filing date.", ["chapter11"]],
      ["What happens to contracts and leases in Chapter 11?", "Subject to court approval and special rules, the debtor may assume, assume and assign, or reject executory contracts and unexpired leases. Assumption usually requires cure and adequate assurance; rejection generally creates a claim.", ["chapter11", "code"]],
      ["Can a business continue operating during Chapter 11?", "Usually yes, as debtor-in-possession, unless a trustee is appointed or the case is converted or dismissed. Transactions outside the ordinary course, new financing and use of cash collateral commonly require court approval.", ["chapter11"]],
      ["What is a Section 363 sale?", "It is a court-authorized sale or lease of estate property outside the ordinary course of business. A sale can transfer assets before plan confirmation and may be approved free and clear of qualifying interests, with those interests attaching to proceeds.", ["chapter11", "code"]],
      ["How do creditors vote on a Chapter 11 plan?", "Only impaired classes vote. Acceptance generally requires, among voting claims in a class, at least two-thirds in amount and more than one-half in number; the court can confirm over rejection if cramdown requirements are met.", ["chapter11", "code"]],
      ["What is confirmation of a Chapter 11 plan?", "Confirmation is the court’s approval after finding that the plan satisfies statutory requirements such as proper classification, feasibility, good faith and required creditor treatment. The confirmed plan binds the debtor and covered stakeholders.", ["chapter11"]],
    ],
  },
  {
    category: "Consequences & Aftermath",
    items: [
      ["How does bankruptcy affect my credit score?", "A bankruptcy filing is a serious negative credit event, but there is no universal point decrease. The effect depends on the existing file, scoring model, later payment history and new credit use.", ["credit"]],
      ["How long does bankruptcy stay on my credit report?", "Under federal credit-reporting rules, a bankruptcy may appear for up to ten years from the relevant order or adjudication date. Individual accounts may age off on their own schedules; dispute inaccurate reporting with the reporting company.", ["credit"]],
      ["Can I get new credit after bankruptcy?", "Yes, but approval, pricing and timing are lender decisions. A discharge does not create a right to credit; compare terms carefully and avoid high-cost products that undermine the fresh start.", ["credit", "alternatives"]],
      ["Will bankruptcy stop foreclosure?", "The automatic stay usually pauses a foreclosure, but the lender may obtain relief and a discharge does not eliminate the mortgage lien. Chapter 13 may allow a cure of arrears while ongoing payments continue.", ["process", "chapter13"]],
      ["Will bankruptcy stop wage garnishment?", "The automatic stay normally stops garnishment for pre-filing debts, and the discharge bars collection of discharged debts. Exceptions include some domestic-support enforcement, and withheld funds may be treated differently under state law.", ["process", "discharge"]],
      ["Will bankruptcy stop repossession?", "It usually pauses a pending repossession, but the creditor may seek stay relief. Keeping the collateral requires an authorized treatment such as payment through a plan, redemption or reaffirmation, plus compliance with applicable obligations.", ["process", "chapter7"]],
      ["Can landlords evict me after I file bankruptcy?", "Sometimes. If the landlord obtained a judgment for possession before filing, the stay is limited, subject to narrow cure procedures in some cases. Endangerment or illegal-drug certifications and post-filing defaults can also permit eviction.", ["forms", "code"]],
      ["How does bankruptcy affect co-debtors or spouses?", "A discharge protects only the debtor, except for limited Chapter 13 co-debtor-stay effects. A non-filing spouse’s property, income and liability depend on state marital-property law, joint debts and the chapter.", ["chapter13", "discharge"]],
      ["Can I travel internationally after filing bankruptcy?", "Bankruptcy itself generally creates no federal travel ban. The debtor must still attend required proceedings, cooperate with the trustee and obey any case-specific court orders.", ["process"]],
      ["Do I have to tell employers about bankruptcy?", "There is no single general duty to volunteer a filing, but lawful applications, security clearances or regulated roles may ask financial-history questions. Bankruptcy Code section 525 restricts specified government and private-employer discrimination.", ["code"]],
    ],
  },
  {
    category: "Special Situations",
    items: [
      ["What happens if I receive a large inheritance after filing?", "In Chapters 7, 11 and 12, an inheritance acquired within 180 days after filing can become estate property. In Chapter 13, property acquired during the case can also affect the estate or plan; prompt disclosure is essential.", ["code", "chapter13"]],
      ["Can gambling debts be discharged?", "They are not categorically excluded, but debts obtained by false pretenses or fraud may be nondischargeable. Recent betting funded by credit, cash advances or misrepresentations can draw creditor scrutiny.", ["discharge", "code"]],
      ["What if I hide assets from the trustee?", "Concealment can lead to denial or revocation of discharge, recovery of the property, dismissal, sanctions and criminal referral. Bankruptcy filings are signed under penalty of perjury; amend and disclose mistakes promptly through proper procedure.", ["chapter7", "fraud"]],
      ["What are the penalties for bankruptcy fraud?", "Knowingly concealing assets, making false oaths, filing false claims or corruptly interfering with a case can be federal crimes. Consequences may include fines, imprisonment, loss of discharge and recovery of assets.", ["fraud", "code"]],
      ["Can student loan borrowers file bankruptcy?", "Yes. Student-loan debt does not prevent a bankruptcy filing, although most covered loans survive unless the debtor obtains an undue-hardship judgment in an adversary proceeding.", ["student", "discharge"]],
      ["How does bankruptcy work for married couples?", "Spouses may file a joint petition or separate cases. Joint filing can reduce duplicate administration, but property, debt, exemptions, income and discharge consequences depend on state law and each spouse’s obligations.", ["forms", "prose"]],
      ["What if only one spouse files?", "Only the filing spouse receives a discharge. The non-filing spouse may remain liable on joint debts, while household income and jointly or community-owned property may still be relevant to the case.", ["forms", "chapter7"]],
      ["Can non-citizens file for bankruptcy in the U.S.?", "Citizenship is not the eligibility test. A person must satisfy Bankruptcy Code section 109’s U.S. domicile, residence, place-of-business or property connection and all chapter-specific requirements.", ["code"]],
      ["How does bankruptcy interact with lawsuits?", "The stay usually pauses litigation against the debtor, while claims owned by the debtor may become estate property controlled by the trustee or debtor-in-possession. The bankruptcy court can determine claim treatment and related jurisdictional issues.", ["process", "code"]],
      ["What happens to pending lawsuits when I file?", "A suit against the debtor is generally stayed unless an exception or stay-relief order applies. A lawsuit claim belonging to the debtor must be scheduled and may be prosecuted, settled or abandoned by the estate representative.", ["process", "chapter7"]],
    ],
  },
  {
    category: "Alternatives & Strategy",
    items: [
      ["What are alternatives to bankruptcy?", "Options can include a direct workout, hardship programme, nonprofit credit counseling, debt-management plan, refinancing, asset sale or negotiated settlement. Compare total cost, tax effects, creditor participation, lawsuit risk and time to completion.", ["alternatives", "counseling"]],
      ["What is debt settlement versus bankruptcy?", "Debt settlement seeks voluntary creditor agreements, often without stopping collection or lawsuits and with possible tax consequences. Bankruptcy is a court process with disclosure, stay and discharge rules; each carries cost and credit effects.", ["alternatives", "process"]],
      ["When is Chapter 7 better than Chapter 13?", "Chapter 7 may fit an eligible debtor who needs a faster discharge and has no non-exempt property they cannot risk. It may be unsuitable when a debtor needs time to cure arrears or protect valuable non-exempt assets.", ["chapter7", "chapter13"]],
      ["When is Chapter 13 better than Chapter 7?", "Chapter 13 may fit an individual with regular income who needs to cure mortgage arrears, retain property, address priority debt or obtain plan-based treatment unavailable in Chapter 7. The debtor must sustain payments for years.", ["chapter13", "chapter7"]],
      ["Can I negotiate with creditors instead of filing?", "Yes. Creditors may offer modified payments, forbearance or settlement, especially before litigation. Agreements should be documented, affordable and evaluated for tax, limitation-period and credit-reporting consequences.", ["alternatives"]],
      ["What is a debt management plan?", "A nonprofit credit counselor may arrange one monthly payment for participating unsecured creditors, often with concessions. It is not a bankruptcy or loan, does not bind nonparticipating creditors and commonly takes several years.", ["alternatives", "counseling"]],
      ["Should I pay certain creditors before filing?", "Do not selectively pay creditors without advice. Payments to relatives or insiders and unusual pre-filing payments may be recoverable preferences; secured, support and essential-service debts present different strategic issues.", ["code", "chapter7"]],
      ["What is the look-back period for transfers?", "Different rules use different periods. Bankruptcy preference law commonly examines 90 days, or one year for insiders; federal fraudulent-transfer law generally reaches two years, while trustees may also use longer state-law periods.", ["code"]],
      ["How do I choose the right chapter?", "Compare eligibility, assets and exemptions, income, secured arrears, priority debts, business goals, discharge scope, cost and ability to fund a plan. Use current local law and obtain case-specific advice before selecting a chapter.", ["basics", "prose"]],
      ["What questions should I ask a bankruptcy attorney before hiring one?", "Ask which chapters fit and why; what property or debts are at risk; total fees and included work; likely timeline; required documents; local trustee and court practices; tax effects; alternatives; communication arrangements; and who will personally handle hearings.", ["prose", "alternatives"]],
    ],
  },
];

export const bankruptcyQuestions: BankruptcyQuestion[] = groups.flatMap((group) =>
  group.items.map(([question, answer, sourceIds], index) => ({
    id: groups.slice(0, groups.indexOf(group)).reduce((total, item) => total + item.items.length, 0) + index + 1,
    category: group.category,
    question,
    answer,
    sourceIds,
  })),
);

export const bankruptcyCategories = groups.map((group) => group.category);

export function getBankruptcySources(ids: string[]) {
  return ids.map((id) => bankruptcySources.find((source) => source.id === id)).filter((source): source is BankruptcySource => Boolean(source));
}
