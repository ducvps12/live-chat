import React, { useState } from 'react';
import { toast } from 'sonner';
import { WorkspaceService } from '@/services/workspace.service';
import { parseEmailList } from '@/utils/onboarding';
import { UseOnboardingReturn } from '@/hooks/useOnboarding';
import { ROLE_OPTIONS } from '@/types/onboarding';

interface Step2Props {
    onboarding: UseOnboardingReturn;
}

interface InviteResultRow {
    email: string;
    role: string;
    status: 'sent' | 'already' | 'failed';
    reason?: string;
}

export const Step2InviteMembers: React.FC<Step2Props> = ({ onboarding }) => {
    const [emailsInput, setEmailsInput] = useState('');
    const [role, setRole] = useState('Agent');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<InviteResultRow[]>([]);

    const workspaceId = onboarding.workspace?.workspaceId;

    const handleSendInvites = async () => {
        if (!workspaceId) {
            toast.error('Workspace không tồn tại');
            return;
        }

        const { valid, invalid } = parseEmailList(emailsInput);

        if (valid.length === 0 && invalid.length === 0) {
            toast.error('Vui lòng nhập ít nhất một email');
            return;
        }

        // Check max emails
        if (valid.length > 50) {
            toast.error('Chỉ được gửi tối đa 50 email một lần');
            return;
        }

        setIsLoading(true);
        const newResults: InviteResultRow[] = [];

        // Add invalid emails to results
        invalid.forEach((email) => {
            newResults.push({
                email,
                role: '—',
                status: 'failed',
                reason: 'Email không hợp lệ',
            });
            onboarding.addInviteResult('failed', email, 'Email không hợp lệ');
        });

        // Send invites for valid emails
        for (const email of valid) {
            try {
                await WorkspaceService.inviteMember(workspaceId, {
                    email,
                    role,
                    message: message || undefined,
                });

                newResults.push({ email, role, status: 'sent' });
                onboarding.addInviteResult('sent', email);
            } catch (err: any) {
                const status = err?.response?.status;
                const msg = err?.response?.data?.message || 'Không thể gửi';

                if (status === 409) {
                    newResults.push({
                        email,
                        role,
                        status: 'already',
                        reason: 'Đã mời hoặc đã là thành viên',
                    });
                    onboarding.addInviteResult('already', email);
                } else {
                    newResults.push({ email, role, status: 'failed', reason: msg });
                    onboarding.addInviteResult('failed', email, msg);
                }
            }
        }

        setResults(newResults);
        setIsLoading(false);
        setEmailsInput('');

        const sentCount = newResults.filter((r) => r.status === 'sent').length;
        if (sentCount > 0) {
            toast.success(`Đã gửi ${sentCount} lời mời thành công!`);
        }
    };

    const handleSkip = () => {
        onboarding.nextStep();
    };

    const handleContinue = () => {
        onboarding.nextStep();
    };

    return (
        <>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                Mời thành viên vào workspace
            </h1>
            <p className="text-neutral-500 text-sm mb-8 leading-relaxed">
                Thêm đồng đội để cùng xử lý inbox. Bạn có thể bỏ qua và thực hiện sau
                trong Cài đặt.
            </p>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                {/* Email Input */}
                <div className="space-y-1.5">
                    <label
                        className="block text-sm font-semibold text-neutral-700"
                        htmlFor="memberEmails"
                    >
                        Email thành viên <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-3 placeholder-neutral-400 transition-all text-neutral-900 min-h-[80px]"
                        id="memberEmails"
                        name="memberEmails"
                        placeholder="email1@company.com, email2@company.com"
                        value={emailsInput}
                        onChange={(e) => setEmailsInput(e.target.value)}
                        disabled={isLoading}
                    />
                    <p className="text-xs text-neutral-400">
                        Bạn có thể dán nhiều email, ngăn cách bằng dấu phẩy hoặc xuống dòng.
                    </p>
                </div>

                {/* Role Select */}
                <div className="space-y-1.5">
                    <label
                        className="block text-sm font-semibold text-neutral-700"
                        htmlFor="defaultRole"
                    >
                        Vai trò mặc định <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <select
                            className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-3 text-neutral-900 appearance-none bg-white pr-10"
                            id="defaultRole"
                            name="defaultRole"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            disabled={isLoading}
                        >
                            {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500">
                            <span className="material-symbols-outlined text-[20px]">
                                expand_more
                            </span>
                        </div>
                    </div>
                </div>

                {/* Invite Message */}
                <div className="space-y-1.5">
                    <label
                        className="block text-sm font-semibold text-neutral-700"
                        htmlFor="inviteMessage"
                    >
                        Lời nhắn mời
                    </label>
                    <textarea
                        className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-3 placeholder-neutral-400 transition-all text-neutral-900"
                        id="inviteMessage"
                        name="inviteMessage"
                        placeholder="Mời bạn tham gia Nemark Inbox để cùng xử lý live chat."
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-3">
                    <button
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                        onClick={handleSendInvites}
                        disabled={isLoading || !emailsInput.trim()}
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
                                Đang gửi...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[20px]">
                                    send
                                </span>
                                Gửi lời mời
                            </>
                        )}
                    </button>

                    {results.length > 0 ? (
                        <button
                            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-primary-600 rounded-lg shadow-sm text-sm font-bold text-primary-600 bg-white hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
                            type="button"
                            onClick={handleContinue}
                        >
                            Tiếp tục
                            <span className="material-symbols-outlined text-[18px]">
                                arrow_forward
                            </span>
                        </button>
                    ) : (
                        <div className="flex justify-center">
                            <button
                                className="text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                                type="button"
                                onClick={handleSkip}
                            >
                                Bỏ qua bước này
                            </button>
                        </div>
                    )}

                    <p className="text-center text-xs text-neutral-400 pt-1">
                        Sau khi gửi, lời mời sẽ được gửi qua email.
                    </p>
                </div>
            </form>

            {/* Results Table */}
            {results.length > 0 && (
                <div className="mt-8 pt-6 border-t border-neutral-100">
                    <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                        Kết quả gửi
                    </h3>
                    <div className="border border-neutral-200 rounded-lg overflow-hidden text-sm">
                        <div className="grid grid-cols-12 bg-neutral-50 border-b border-neutral-200 py-2 px-3 text-xs font-semibold text-neutral-500">
                            <div className="col-span-5">Email</div>
                            <div className="col-span-4">Vai trò</div>
                            <div className="col-span-3 text-right">Trạng thái</div>
                        </div>
                        {results.map((row, idx) => (
                            <div
                                key={idx}
                                className="grid grid-cols-12 items-center py-2.5 px-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition-colors"
                            >
                                <div className="col-span-5 text-neutral-800 font-medium truncate pr-2">
                                    {row.email}
                                </div>
                                <div className="col-span-4 text-neutral-600 text-xs">
                                    {row.role}
                                </div>
                                <div className="col-span-3 flex justify-end">
                                    {row.status === 'sent' && (
                                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                            Sent
                                        </span>
                                    )}
                                    {row.status === 'already' && (
                                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-neutral-500/10 whitespace-nowrap">
                                            Already invited
                                        </span>
                                    )}
                                    {row.status === 'failed' && (
                                        <span
                                            className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10"
                                            title={row.reason}
                                        >
                                            Failed
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default Step2InviteMembers;
