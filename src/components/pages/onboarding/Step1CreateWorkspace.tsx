import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { WorkspaceService } from '@/services/workspace.service';
import { validateWorkspaceName, normalizeWorkspaceName } from '@/utils/onboarding';
import { UseOnboardingReturn } from '@/hooks/useOnboarding';

interface Step1Props {
    onboarding: UseOnboardingReturn;
}

export const Step1CreateWorkspace: React.FC<Step1Props> = ({ onboarding }) => {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const handleSubmit = async () => {
        setError('');

        // Validate
        const normalized = normalizeWorkspaceName(name);
        const validation = validateWorkspaceName(normalized);

        if (!validation.valid) {
            setError(validation.error || 'Tên không hợp lệ');
            return;
        }

        setIsLoading(true);

        try {
            const result = await WorkspaceService.create({ name: normalized });

            // Save workspace to onboarding state
            onboarding.setWorkspace({
                workspaceId: result.workspace.workspaceId,
                workspaceKey: result.workspace.workspaceKey,
                name: result.workspace.name,
            });

            toast.success('Tạo workspace thành công!');

            // Invalidate workspaces cache to refresh the list
            queryClient.invalidateQueries({ queryKey: ['workspaces'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });

            // Move to next step
            onboarding.nextStep();
        } catch (err: any) {
            console.error('Create workspace failed:', err);

            if (err?.response?.status === 409) {
                setError('Workspace đã tồn tại hoặc có xung đột, vui lòng thử lại.');
            } else if (err?.response?.status === 400) {
                setError(err?.response?.data?.message || 'Dữ liệu không hợp lệ.');
            } else {
                setError('Không thể tạo workspace. Vui lòng thử lại.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const processFile = useCallback((file: File) => {
        // Validate file type
        if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
            toast.error('Chỉ hỗ trợ file PNG hoặc JPG.');
            return;
        }

        // Validate file size
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File quá lớn. Tối đa 5MB.');
            return;
        }

        setLogoFile(file);

        // Create preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
            setLogoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    }, [processFile]);

    const removeLogo = () => {
        setLogoFile(null);
        setLogoPreview(null);
    };

    return (
        <>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                Tạo workspace của bạn
            </h1>
            <p className="text-neutral-500 text-sm mb-8 leading-relaxed">
                Một workspace đại diện cho một công ty, nhóm, hoặc dự án nơi các cuộc
                hội thoại được quản lý.
            </p>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                {/* Workspace Name Input */}
                <div className="space-y-1.5">
                    <label
                        className="block text-sm font-semibold text-neutral-700"
                        htmlFor="workspaceName"
                    >
                        Tên workspace
                    </label>
                    <input
                        className={`block w-full rounded-lg border shadow-sm focus:ring-primary-500 sm:text-sm py-2.5 px-3 placeholder-neutral-400 transition-all text-neutral-900 ${error
                            ? 'border-red-300 focus:border-red-500'
                            : 'border-neutral-300 focus:border-primary-500'
                            }`}
                        id="workspaceName"
                        name="workspaceName"
                        placeholder="Ví dụ: Công ty ABC"
                        type="text"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            setError('');
                        }}
                        disabled={isLoading}
                        autoFocus
                    />
                    {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
                </div>

                {/* Logo Upload (Optional) */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="block text-sm font-semibold text-neutral-700">
                            Logo workspace
                        </label>
                        <span className="text-xs text-neutral-400 font-medium bg-neutral-100 px-2 py-0.5 rounded-full">
                            Không bắt buộc
                        </span>
                    </div>

                    {/* Preview or Upload Zone */}
                    {logoPreview ? (
                        // Preview State
                        <div className="mt-1 flex items-center gap-4 p-4 border border-neutral-200 rounded-lg bg-neutral-50/50">
                            <div className="relative">
                                <img
                                    src={logoPreview}
                                    alt="Logo preview"
                                    className="w-16 h-16 rounded-lg object-cover border border-neutral-200 shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={removeLogo}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm transition-colors"
                                    title="Xóa logo"
                                >
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-neutral-800 truncate">
                                    {logoFile?.name}
                                </p>
                                <p className="text-xs text-neutral-400">
                                    {logoFile && (logoFile.size / 1024).toFixed(1)} KB
                                </p>
                            </div>
                            <label
                                htmlFor="file-upload-change"
                                className="text-sm font-medium text-primary-600 hover:text-primary-700 cursor-pointer"
                            >
                                Thay đổi
                                <input
                                    className="sr-only"
                                    id="file-upload-change"
                                    type="file"
                                    accept="image/png,image/jpeg"
                                    onChange={handleLogoChange}
                                />
                            </label>
                        </div>
                    ) : (
                        // Upload State with Drag & Drop
                        <div
                            className={`group mt-1 flex justify-center px-6 pt-6 pb-6 border-2 border-dashed rounded-lg transition-all cursor-pointer ${isDragging
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-neutral-200 hover:border-primary-400 hover:bg-primary-50/30 bg-neutral-50/50'
                                }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className="space-y-2 text-center w-full">
                                <div className={`mx-auto h-12 w-12 transition-all flex items-center justify-center rounded-full bg-white shadow-sm border border-neutral-100 ${isDragging
                                    ? 'text-primary-600 scale-110'
                                    : 'text-neutral-400 group-hover:text-primary-600 group-hover:scale-110'
                                    } duration-200`}>
                                    <span className="material-symbols-outlined text-[24px]">
                                        {isDragging ? 'download' : 'cloud_upload'}
                                    </span>
                                </div>
                                <div className="text-sm text-neutral-600">
                                    <label
                                        className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none"
                                        htmlFor="file-upload"
                                    >
                                        <span>Tải lên file</span>
                                        <input
                                            className="sr-only"
                                            id="file-upload"
                                            name="file-upload"
                                            type="file"
                                            accept="image/png,image/jpeg"
                                            onChange={handleLogoChange}
                                        />
                                    </label>
                                    <span className="pl-1">hoặc kéo thả vào đây</span>
                                </div>
                                <p className="text-xs text-neutral-400">PNG, JPG tối đa 5MB</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                    <button
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                        onClick={handleSubmit}
                        disabled={isLoading || !name.trim()}
                    >
                        {isLoading ? (
                            <>
                                <svg
                                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                Đang tạo...
                            </>
                        ) : (
                            <>
                                Tạo workspace
                                <span className="material-symbols-outlined text-[18px]">
                                    arrow_forward
                                </span>
                            </>
                        )}
                    </button>
                    <p className="mt-4 text-center text-xs text-neutral-400">
                        Bạn có thể thay đổi điều này sau trong phần Cài đặt
                    </p>
                </div>
            </form>
        </>
    );
};

export default Step1CreateWorkspace;
