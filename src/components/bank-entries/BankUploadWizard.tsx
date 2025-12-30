"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileSpreadsheet, CheckCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { read, utils } from "xlsx";

// Sub-components
import { Step1Upload } from "./Step1Upload";
import { Step2Mapping } from "./Step2Mapping";
import { Step3Validation } from "./Step3Validation";
import { Step4Post } from "./Step4Post";


const STEPS = [
    { id: 1, label: "Upload Statement" },
    { id: 2, label: "Mapping" },
    { id: 3, label: "Validation" },
    { id: 4, label: "Post to QBO" },
];

export function BankUploadWizard() {
    const [currentStep, setCurrentStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);

    const [selectedBankId, setSelectedBankId] = useState<string>("");

    const handleFileSelect = (selectedFile: File) => {
        setFile(selectedFile);
    };

    const handleBankSelect = (id: string) => {
        setSelectedBankId(id);
    };

    const processFile = async () => {
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = read(data);
            const worksheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[worksheetName];
            // Use raw: false to get formatted strings, and dateNF to force YYYY-MM-DD if possible for dates
            const jsonData = utils.sheet_to_json(worksheet, {
                raw: false,
                dateNF: 'yyyy-mm-dd',
                defval: "" // Default empty cells to empty string
            });
            setParsedData(jsonData);

            // Move to next step after parsing
            setCurrentStep(prev => prev + 1);
        } catch (error) {
            console.error("Error parsing file:", error);
            alert("Failed to parse file. Please ensure it is a valid Excel or CSV file.");
        }
    };

    const handleNext = () => {
        if (currentStep === 1) {
            processFile();
        } else if (currentStep < 4) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(prev => prev - 1);
    };

    const handleReset = () => {
        setFile(null);
        setParsedData([]);
        setCurrentStep(1);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Wizard Progress Header */}
            <div className="relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -z-10" />
                <div className="flex justify-between">
                    {STEPS.map((step) => {
                        const isActive = currentStep >= step.id;
                        const isCurrent = currentStep === step.id;
                        return (
                            <div key={step.id} className="flex flex-col items-center bg-transparent px-4">
                                <div
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2",
                                        isActive ? "bg-primary text-primary-foreground border-primary glow-primary" : "bg-black/40 text-muted-foreground border-white/10",
                                        isCurrent && "ring-4 ring-primary/20"
                                    )}
                                >
                                    {isActive ? <CheckCircle size={20} /> : step.id}
                                </div>
                                <span className={cn("text-xs font-medium mt-2", isActive ? "text-primary" : "text-muted-foreground")}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="w-full">
                <Card className="min-h-[500px] glass border-white/10">
                    <CardContent className="p-8">
                        {currentStep === 1 && <Step1Upload onNext={handleNext} onFileSelect={handleFileSelect} selectedFile={file} onBankSelect={handleBankSelect} selectedBankId={selectedBankId} />}
                        {currentStep === 2 && <Step2Mapping onNext={handleNext} onBack={handleBack} data={parsedData} setData={setParsedData} />}
                        {currentStep === 3 && <Step3Validation onNext={handleNext} onBack={handleBack} data={parsedData} />}
                        {currentStep === 4 && <Step4Post onBack={handleBack} onReset={handleReset} data={parsedData} bankAccountId={selectedBankId} />}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
