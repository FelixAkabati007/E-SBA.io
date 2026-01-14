import React, { useState, useRef } from "react";
import {
  ImageIcon,
  Loader2,
  Upload,
  Save,
  RotateCw,
  Trash2,
  AlertCircle,
  Eye,
  Calendar,
} from "lucide-react";
import SignatureUpload from "./SignatureUpload";
import { apiClient } from "../lib/apiClient";

export interface SchoolConfig {
  name: string;
  motto: string;
  headTeacher: string;
  address: string;
  catWeight: number;
  examWeight: number;
  logoUrl: string | null;
  headSignatureUrl?: string | null;
  signatureEnabled?: boolean;
}

interface SystemSetupProps {
  schoolConfig: SchoolConfig;
  setSchoolConfig: React.Dispatch<React.SetStateAction<SchoolConfig>>;
  academicYear: string;
  setAcademicYear: (year: string) => void;
  academicYearOptions: string[];
  term: string;
  setTerm: (term: string) => void;
  onNavigate: (view: string) => void;
}

export const SystemSetup: React.FC<SystemSetupProps> = ({
  schoolConfig,
  setSchoolConfig,
  academicYear,
  setAcademicYear,
  academicYearOptions,
  term,
  setTerm,
  onNavigate,
}) => {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoFeedback, setLogoFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    setIsProcessingLogo(true);
    setLogoFeedback(null);
    setLogoFile(null);
    const validTypes = ["image/jpeg", "image/png", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      setLogoError("Invalid file type.");
      setIsProcessingLogo(false);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("File too large.");
      setIsProcessingLogo(false);
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxDim = 300;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        setSchoolConfig((prev) => ({
          ...prev,
          logoUrl: canvas.toDataURL(file.type),
        }));
        setIsProcessingLogo(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveLogoToServer = async () => {
    if (!logoFile) return;
    setIsLogoUploading(true);
    setLogoFeedback(null);
    try {
      const r = await apiClient.uploadSchoolLogo(logoFile);
      setLogoFeedback(
        r.ok ? "Logo saved successfully." : "Failed to save logo."
      );
      setLogoFile(null);
    } catch (e) {
      setLogoFeedback((e as Error).message || "Upload failed");
    } finally {
      setIsLogoUploading(false);
    }
  };

  const rotateLogo = () => {
    if (!schoolConfig.logoUrl) return;
    setIsProcessingLogo(true);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.height;
      canvas.height = img.width;
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
      }
      setSchoolConfig((prev) => ({ ...prev, logoUrl: canvas.toDataURL() }));
      setIsProcessingLogo(false);
    };
    img.src = schoolConfig.logoUrl;
  };

  const removeLogo = () => {
    setSchoolConfig((prev) => ({ ...prev, logoUrl: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-800">
          System Setup & Configuration
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4 text-blue-800 border-b border-blue-50 pb-2">
            <ImageIcon size={20} />
            <h3 className="text-lg font-bold">School Profile</h3>
          </div>
          <div className="space-y-4">
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                School Logo (Terminal Reports)
              </label>
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative group w-32 h-32 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                  {schoolConfig.logoUrl ? (
                    <img
                      src={schoolConfig.logoUrl}
                      alt="School Logo"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <ImageIcon className="text-slate-300" size={48} />
                  )}
                  {isProcessingLogo && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <Loader2
                        className="animate-spin text-blue-600"
                        size={24}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept=".png,.jpg,.jpeg,.svg"
                    className="hidden"
                    aria-label="Upload logo"
                    title="Upload logo"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded hover:bg-blue-200 transition-colors"
                  >
                    <Upload size={14} /> Upload
                  </button>
                  <button
                    onClick={saveLogoToServer}
                    disabled={!logoFile || isLogoUploading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      !logoFile || isLogoUploading
                        ? "bg-emerald-200 text-white cursor-not-allowed"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                    aria-label="Save logo"
                    title="Save logo"
                  >
                    {isLogoUploading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save size={14} /> Save
                      </>
                    )}
                  </button>
                  {schoolConfig.logoUrl && (
                    <>
                      <button
                        onClick={rotateLogo}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded hover:bg-slate-200 transition-colors"
                      >
                        <RotateCw size={14} /> Rotate
                      </button>
                      <button
                        onClick={removeLogo}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </>
                  )}
                </div>
                <div className="text-center">
                  {logoError ? (
                    <p className="text-xs text-red-600 flex items-center gap-1 justify-center">
                      <AlertCircle size={12} /> {logoError}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Rec: 300x300px (Max 2MB)
                    </p>
                  )}
                </div>
                {logoFeedback && (
                  <p className="text-xs text-emerald-700">{logoFeedback}</p>
                )}
                {schoolConfig.logoUrl && (
                  <button
                    onClick={() => onNavigate("report")}
                    className="w-full mt-2 flex items-center justify-center gap-2 text-xs text-blue-600 hover:underline"
                  >
                    <Eye size={12} /> Test on Report
                  </button>
                )}
              </div>
            </div>
            <div>
              <label
                htmlFor="school-name"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                School Name
              </label>
              <input
                id="school-name"
                type="text"
                value={schoolConfig.name}
                onChange={(e) =>
                  setSchoolConfig({ ...schoolConfig, name: e.target.value })
                }
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="motto"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Motto
              </label>
              <input
                id="motto"
                type="text"
                value={schoolConfig.motto}
                onChange={(e) =>
                  setSchoolConfig({ ...schoolConfig, motto: e.target.value })
                }
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="head-teacher"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Head Teacher's Name
              </label>
              <input
                id="head-teacher"
                type="text"
                value={schoolConfig.headTeacher}
                onChange={(e) =>
                  setSchoolConfig({
                    ...schoolConfig,
                    headTeacher: e.target.value,
                  })
                }
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="school-address"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                School Address
              </label>
              <textarea
                id="school-address"
                value={schoolConfig.address}
                onChange={(e) =>
                  setSchoolConfig({ ...schoolConfig, address: e.target.value })
                }
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
              />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-fit">
          <div className="flex items-center gap-2 mb-4 text-emerald-800 border-b border-emerald-50 pb-2">
            <Calendar size={20} />
            <h3 className="text-lg font-bold">Academic Configuration</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="academic-year"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Current Year
                </label>
                <select
                  id="academic-year"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                >
                  {academicYearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="current-term"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Current Term
                </label>
                <select
                  id="current-term"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                >
                  <option>Term 1</option>
                  <option>Term 2</option>
                  <option>Term 3</option>
                </select>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 mt-4">
              <h4 className="text-sm font-bold text-slate-800 mb-3">
                Assessment Weighting
              </h4>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="cat-weight"
                    className="block text-xs font-bold text-slate-500 mb-1"
                  >
                    Class Score (CAT)
                  </label>
                  <div className="relative">
                    <input
                      id="cat-weight"
                      type="number"
                      value={schoolConfig.catWeight}
                      onChange={(e) =>
                        setSchoolConfig({
                          ...schoolConfig,
                          catWeight: parseInt(e.target.value),
                          examWeight: 100 - parseInt(e.target.value),
                        })
                      }
                      className="w-full p-2 border border-slate-300 rounded pr-8"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 text-sm">
                      %
                    </span>
                  </div>
                </div>
                <div className="font-bold text-slate-400 pt-5">:</div>
                <div className="flex-1">
                  <label
                    htmlFor="exam-weight"
                    className="block text-xs font-bold text-slate-500 mb-1"
                  >
                    Exam Score
                  </label>
                  <div className="relative">
                    <input
                      id="exam-weight"
                      type="number"
                      value={schoolConfig.examWeight}
                      readOnly
                      className="w-full p-2 border border-slate-300 rounded bg-slate-50 pr-8"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 text-sm">
                      %
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2 italic">
                Note: Changing weighting requires system recalculation.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4 text-slate-800 border-b border-slate-50 pb-2">
            <ImageIcon size={20} />
            <h3 className="text-lg font-bold">Headmaster's Signature</h3>
          </div>
          <SignatureUpload
            value={schoolConfig.headSignatureUrl ?? null}
            onChange={(url) =>
              setSchoolConfig((prev) => ({ ...prev, headSignatureUrl: url }))
            }
            academicYear={academicYear}
            term={term}
            enabled={!!schoolConfig.signatureEnabled}
            onToggleEnabled={(enabled) =>
              setSchoolConfig((prev) => ({
                ...prev,
                signatureEnabled: enabled,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
};
