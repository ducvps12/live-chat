import { useTranslation } from 'react-i18next';
import { useState } from 'react';

export default function IndustryFilter() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'industry' | 'role'>('industry');

    return (
        <section className="relative z-20 -mt-8 px-4 lg:px-6 mb-16">
            <div className="max-w-[1000px] mx-auto bg-white rounded-2xl p-6 lg:p-8 border border-gray-200 shadow-lg">
                <div className="flex flex-col gap-6">
                    {/* Tabs and Search */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-200 pb-6">
                        {/* Tab Switcher */}
                        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                            <button
                                onClick={() => setActiveTab('industry')}
                                className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'industry'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                {t('solutions.filter.tabs.industry')}
                            </button>
                            <button
                                onClick={() => setActiveTab('role')}
                                className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'role'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                {t('solutions.filter.tabs.role')}
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full md:w-96 group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-electric-blue transition-colors">
                                search
                            </span>
                            <input
                                type="text"
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-electric-blue/20 focus:border-electric-blue transition-all outline-none"
                                placeholder={t('solutions.filter.searchPlaceholder')}
                            />
                        </div>
                    </div>

                    {/* Filter Chips */}
                    <div className="space-y-4">
                        {/* Industry Filters */}
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-bold text-gray-500 uppercase mr-2">
                                {t('solutions.filter.industries.label')}
                            </span>
                            <button className="px-4 py-1.5 rounded-full border border-electric-blue bg-electric-blue/10 text-sm text-electric-blue hover:bg-electric-blue/20 transition-all">
                                {t('solutions.filter.industries.ecommerce')}
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                                {t('solutions.filter.industries.saas')}
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                                {t('solutions.filter.industries.education')}
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                                {t('solutions.filter.industries.realestate')}
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                                {t('solutions.filter.industries.services')}
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                                {t('solutions.filter.industries.agency')}
                            </button>
                        </div>

                        {/* Role Filters */}
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-bold text-gray-500 uppercase mr-2">
                                {t('solutions.filter.roles.label')}
                            </span>
                            <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                                {t('solutions.filter.roles.sales')}
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                                {t('solutions.filter.roles.support')}
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                                {t('solutions.filter.roles.techSupport')}
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                                {t('solutions.filter.roles.manager')}
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                                {t('solutions.filter.roles.developer')}
                            </button>
                            <button className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline decoration-gray-400 underline-offset-4 transition-colors">
                                {t('solutions.filter.clearFilter')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
