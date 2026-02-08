import { useTranslation } from 'react-i18next';

const steps = [
    { key: 'step1', activeColor: 'border-electric-blue border-l-electric-blue' },
    { key: 'step2', activeColor: 'hover:border-l-purple-500 hover:border-purple-500' },
    { key: 'step3', activeColor: 'hover:border-l-electric-teal hover:border-electric-teal' },
    { key: 'step4', activeColor: '  hover:border-l-green-500 hover:border-green-500' },
];

export default function DemoSteps() {
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            {steps.map((step, index) => (
                <div
                    key={step.key}
                    className={`bg-white border border-gray-200 p-4 rounded-xl border-l-4 cursor-pointer hover:shadow-lg transition-all duration-300 ${index === 0 ? 'border-l-electric-blue bg-electric-blue/5' : `${step.activeColor}`
                        } group`}
                >
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                        <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0
                                    ? 'bg-electric-blue text-white'
                                    : 'bg-gray-200 text-gray-700 group-hover:bg-current group-hover:text-white'
                                }`}
                        >
                            {t(`demo.steps.${step.key}.number`)}
                        </span>
                        <h4 className={`font-bold text-sm ${index === 0 ? 'text-gray-900' : 'text-gray-900'}`}>
                            {t(`demo.steps.${step.key}.title`)}
                        </h4>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-600 leading-relaxed">
                        {t(`demo.steps.${step.key}.description`)}
                    </p>
                </div>
            ))}
        </div>
    );
}
