"use client";

import { FormEvent, useEffect, useState } from "react";
import { CategoryOne, categoryOptions, RecordRisk, RecordStatus } from "@/lib/recordStore";
import { ClientRecord, ClientRecordInput } from "@/lib/clientWorkspace";
import { getClientWorkspaceState } from "@/lib/clientWorkspaceStore";

const fieldClass = "mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100";

type Props = {
  record?: ClientRecord;
  initialExpiryDate?: string;
  onSubmit: (input: ClientRecordInput) => void;
  onCancel?: () => void;
};

export default function ClientRecordForm({ record, initialExpiryDate, onSubmit, onCancel }: Props) {
  const [people, setPeople] = useState<ReturnType<typeof getClientWorkspaceState>["people"]>([]);
  const [values, setValues] = useState<ClientRecordInput>({
    name: record?.name || "",
    referenceNumber: record?.referenceNumber || "",
    category: record?.category || "Other",
    category2: record?.category2 || categoryOptions.Other[0],
    issueDate: record?.issueDate || "",
    expiryDate: record?.expiryDate || initialExpiryDate || "",
    status: record?.status || "Current",
    risk: record?.risk || "Medium",
    contactId: "",
    followUp: record?.followUp || "",
    nextAction: record?.nextAction || "",
    notes: record?.notes || "",
    reminderFrequency: record?.reminderFrequency || "weekly",
    reminderLeadDays: record?.reminderLeadDays ?? 7,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const activePeople = getClientWorkspaceState().people.filter((person) => person.active);
      setPeople(activePeople);
      const recordContact = activePeople.find((person) => person.name === record?.contact);
      setValues((current) => ({ ...current, contactId: current.contactId || recordContact?.id || activePeople[0]?.id || "" }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [record?.contact]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.contactId) {
      setError("Add a responsible person in Work Tracker before creating a record.");
      return;
    }
    if (values.issueDate && values.issueDate > values.expiryDate) {
      setError("Issue date cannot be after the expiry date.");
      return;
    }
    setError("");
    onSubmit(values);
  }

  const types = categoryOptions[values.category];
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6">
      <div className="sm:col-span-2"><h3 className="text-lg font-bold text-slate-950">{record ? "Edit client-submitted record" : "Add record to monitor"}</h3><p className="mt-1 text-sm text-slate-600">Metadata only. Do not enter confidential document contents or upload files.</p></div>
      {error && <p role="alert" className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <label className="text-sm font-semibold text-slate-700">Record name<input required maxLength={120} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Reference number (optional)<input maxLength={80} value={values.referenceNumber} onChange={(event) => setValues({ ...values, referenceNumber: event.target.value })} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Category<select required value={values.category} onChange={(event) => { const category = event.target.value as CategoryOne; setValues({ ...values, category, category2: categoryOptions[category][0] }); }} className={fieldClass}>{Object.keys(categoryOptions).map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Record type<select required value={values.category2} onChange={(event) => setValues({ ...values, category2: event.target.value })} className={fieldClass}>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Issue date (optional)<input type="date" value={values.issueDate} onChange={(event) => setValues({ ...values, issueDate: event.target.value })} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Expiry date<input required type="date" value={values.expiryDate} onChange={(event) => setValues({ ...values, expiryDate: event.target.value })} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Status<select value={values.status} onChange={(event) => setValues({ ...values, status: event.target.value as RecordStatus })} className={fieldClass}><option>Current</option><option>Awaiting confirmation</option><option>Paused</option><option>Completed</option></select></label>
      <label className="text-sm font-semibold text-slate-700">Risk<select value={values.risk} onChange={(event) => setValues({ ...values, risk: event.target.value as RecordRisk })} className={fieldClass}>{(["Low", "Medium", "High"] as const).map((risk) => <option key={risk}>{risk}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Responsible person<select required value={values.contactId} onChange={(event) => setValues({ ...values, contactId: event.target.value })} className={fieldClass}><option value="">Select a responsible person</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Next follow-up date (optional)<input type="date" value={values.followUp} onChange={(event) => setValues({ ...values, followUp: event.target.value })} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700">Next action<input maxLength={160} value={values.nextAction} onChange={(event) => setValues({ ...values, nextAction: event.target.value })} className={fieldClass} placeholder="Confirm renewal dates" /></label>
      <label className="text-sm font-semibold text-slate-700">Reminder frequency<select value={values.reminderFrequency} onChange={(event) => setValues({ ...values, reminderFrequency: event.target.value as ClientRecordInput["reminderFrequency"] })} className={fieldClass}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom</option></select></label>
      <label className="text-sm font-semibold text-slate-700">Reminder lead time (days)<input required type="number" min={0} max={365} value={values.reminderLeadDays} onChange={(event) => setValues({ ...values, reminderLeadDays: Number(event.target.value) })} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Operational notes only<textarea maxLength={500} rows={3} value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} className={`${fieldClass} py-3`} placeholder="Do not include confidential document contents." /></label>
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" className="min-h-[44px] rounded-xl bg-teal-600 px-5 font-semibold text-white hover:bg-teal-700">{record ? "Save changes" : "Create monitored record"}</button>{onCancel && <button type="button" onClick={onCancel} className="min-h-[44px] rounded-xl border border-slate-300 px-5 font-semibold text-slate-700">Cancel</button>}</div>
      {people.length === 0 && <p className="sm:col-span-2 text-sm text-amber-800">No authorised contacts are available. Add a responsible person from the Work Tracker page first.</p>}
    </form>
  );
}
