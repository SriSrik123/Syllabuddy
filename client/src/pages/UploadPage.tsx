import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { syllabusAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Upload, FileText, X, Loader2, Check } from 'lucide-react';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.png', '.jpg', '.jpeg'];

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [className, setClassName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  };

  const validateAndSetFile = (f: File) => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error('Unsupported file type. Please upload PDF, DOCX, PNG, or JPG files.');
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !className.trim()) {
      toast.error('Please provide a class name and select a file');
      return;
    }

    setUploading(true);
    try {
      await syllabusAPI.upload(file, className.trim());
      toast.success('Syllabus uploaded and processed.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Syllabus</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          We'll extract important dates and enable AI-powered Q&A.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Class Name */}
        <div>
          <label htmlFor="className" className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Course name
          </label>
          <input
            id="className"
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            required
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            placeholder="e.g. CS 101 — Intro to Computer Science"
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            File
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-md px-4 py-6 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/20'
                : file
                ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/10'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Drop your file here, or <span className="text-blue-600 dark:text-blue-400 font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  PDF, DOCX, PNG, or JPG up to 20 MB
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) validateAndSetFile(f);
            }}
            className="hidden"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={uploading || !file || !className.trim()}
          className="w-full py-2.5 bg-blue-600 text-white rounded-md text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <FileText className="w-3.5 h-3.5" />
              Upload Syllabus
            </>
          )}
        </button>

        {uploading && (
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Extracting text and important dates. This may take a moment.
          </p>
        )}
      </form>
    </div>
  );
}
