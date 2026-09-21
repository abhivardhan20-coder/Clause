export type Clause = {
  id: number;
  title: string;
  text: string;
  explanation: string;
  attention: "review" | "clarify" | "info";
  question: string;
};
export type Review = {
  summary: string;
  clauses: Clause[];
  checklist: string[];
  mode: "sample" | "ai" | "unreviewed";
  title: string;
};
export const sample: Review = {
  title: "Freelance services agreement",
  mode: "sample",
  summary:
    "You’re agreeing to provide design services for Northstar Studio for $4,800. The agreement covers payment, ownership of your work, confidentiality, and how either side can end the project.",
  clauses: [
    {
      id: 1,
      title: "Scope of services",
      text: "Alex Morgan (the Designer) shall provide brand identity design services to Northstar Studio (the Client), including a logo, a visual style guide, and revisions as requested by the Client. The engagement continues until completion of the services.",
      explanation:
        "You will create a logo and a visual style guide. Revisions are included, but this clause does not limit their number or define when the work is complete.",
      attention: "clarify",
      question:
        "How many revision rounds are included, and what counts as completed work?",
    },
    {
      id: 2,
      title: "Fees and payment",
      text: "The Client shall pay the Designer a fixed fee of USD 4,800, payable within thirty (30) days of receipt of the final invoice. The Designer shall submit the final invoice upon completion. No advance payment is required.",
      explanation:
        "You invoice after the work is complete. The client then has 30 days from receiving the invoice to pay the $4,800 fee. No deposit is due.",
      attention: "info",
      question:
        "Could we agree on a deposit and milestone payments before work begins?",
    },
    {
      id: 3,
      title: "Termination",
      text: "Either party may terminate this Agreement by giving seven (7) days’ written notice to the other party. Upon termination, the Designer shall promptly deliver all completed and in-progress work to the Client.",
      explanation:
        "Either side can end the agreement with 7 days’ written notice. You must hand over completed and unfinished work, but this clause does not specify payment for it.",
      attention: "clarify",
      question:
        "If the project ends early, how will completed and in-progress work be paid for?",
    },
    {
      id: 4,
      title: "Intellectual property",
      text: "All rights, title, and interest in the work product created in connection with this Agreement shall vest exclusively in the Client immediately upon creation, irrespective of payment status.",
      explanation:
        "The client owns the work as soon as you create it, even before paying you. Consider discussing whether ownership should transfer after full payment.",
      attention: "review",
      question:
        "Can ownership transfer only after the corresponding invoice is paid in full?",
    },
    {
      id: 5,
      title: "Confidentiality",
      text: "Each party shall keep confidential any non-public business information received from the other party and shall use such information solely to perform this Agreement. This obligation survives termination for two (2) years.",
      explanation:
        "Both sides must keep non-public business information private and use it only for this project. This duty continues for 2 years after termination.",
      attention: "info",
      question:
        "What information is confidential, and may completed work appear in my portfolio?",
    },
    {
      id: 6,
      title: "Changes to the agreement",
      text: "Any amendment to this Agreement must be made in writing and signed by both parties. This Agreement contains the entire understanding between the parties concerning the services.",
      explanation:
        "Changes need written agreement and both signatures. Earlier conversations are not included unless reflected in the agreement.",
      attention: "info",
      question:
        "Have all promised deliverables, dates, and payments been included in writing?",
    },
  ],
  checklist: [
    "Agree on a maximum number of revision rounds and a completion milestone.",
    "Clarify payment for completed and in-progress work if the project ends early.",
    "Discuss linking ownership transfer to full payment.",
    "Prepare the agreement and your questions for a qualified lawyer.",
  ],
};
export const sampleText = sample.clauses
  .map((c) => `${c.id}. ${c.title}\n${c.text}`)
  .join("\n\n");
export const revisedSample = sampleText
  .replace(
    "and revisions as requested by the Client",
    "and up to two rounds of revisions requested by the Client",
  )
  .replace("seven (7)", "fourteen (14)")
  .replace(
    "Upon termination, the Designer shall promptly deliver all completed and in-progress work to the Client.",
    "Upon termination, the Client shall pay for completed and in-progress work on a pro-rata basis before its delivery.",
  )
  .replace(
    "immediately upon creation, irrespective of payment status",
    "only upon receipt of full payment for the relevant work product",
  );
export function sampleAnswer(question: string): {
  answer: string;
  ids: number[];
} {
  const q = question.toLowerCase();
  if (/should i sign|enforce|illegal|legal in|court|sue|my rights/.test(q))
    return {
      answer:
        "The document alone cannot establish your legal rights or whether you should sign. A qualified lawyer in the relevant jurisdiction can assess enforceability and your circumstances. I can help you prepare questions about the sample clauses.",
      ids: [],
    };
  if (/paid|payment|money|fee|invoice|deposit/.test(q))
    return {
      answer:
        sample.clauses[1].explanation +
        " Ownership transfers before payment under clause 4; that is a separate point to discuss.",
      ids: [2, 4],
    };
  if (/end|terminat|cancel|notice/.test(q))
    return {
      answer:
        sample.clauses[2].explanation +
        " Ask how payment for unfinished work would be calculated.",
      ids: [3],
    };
  if (/owner|copyright|intellectual|rights/.test(q))
    return { answer: sample.clauses[3].explanation, ids: [4] };
  if (/confiden|private|portfolio/.test(q))
    return { answer: sample.clauses[4].explanation, ids: [5] };
  if (/revision|scope|deliver/.test(q))
    return { answer: sample.clauses[0].explanation, ids: [1] };
  if (/look out|risk|attention|review|summary|summar/.test(q))
    return {
      answer:
        "Three points deserve a closer look: ownership transfers before payment; ending the agreement does not address payment for unfinished work; and revision rounds are unlimited. These are document observations, not a conclusion about legality.",
      ids: [1, 3, 4],
    };
  return {
    answer:
      "This sample walkthrough supports questions about payment, termination, ownership, confidentiality, and revisions. For other questions, inspect the original clauses or use live AI once configured. I cannot establish anything the agreement does not state.",
    ids: [],
  };
}
