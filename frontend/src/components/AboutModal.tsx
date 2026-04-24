/**
 * About modal — academic attribution and rights notice for this project.
 */
interface Props {
  onClose: () => void;
}

export default function AboutModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header band */}
        <div className="bg-slate-800 px-8 py-5">
          <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-slate-400 mb-1">
            IU Internationale Hochschule
          </p>
          <h1 className="text-lg font-semibold text-white leading-snug">
            Wind Turbine Data Stream Simulator
          </h1>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5 text-sm text-gray-700">

          {/* Course */}
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Course</p>
            <p className="font-medium text-gray-800">DLBDSMTP01 — From Model to Production</p>
            <p className="text-gray-500">Big Data Masterclass · IU International University of Applied Sciences</p>
          </div>

          {/* Supervisors */}
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Academic Supervisors</p>
            <p className="text-gray-800">Prof. Dr.-Ing. Anna Androvitsanea</p>
            <p className="text-gray-800">Prof. Dr. Christian Müller-Kett</p>
          </div>

          {/* Author */}
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Developed by</p>
            <p className="text-gray-800 font-medium">Juan Carlos Laverde</p>
            <p className="text-gray-500">Student ID: UPS10797707 · Academic Year 2025–2026</p>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Description</p>
            <p className="text-gray-600 leading-relaxed">
              This application is a real-time simulator for wind turbine sensor data streams.
              It supports the creation and management of wind parks, generating continuous
              multi-sensor readings — temperature, noise level, relative humidity, and wind speed —
              to facilitate the monitoring, archival, and early detection of potential equipment
              anomalies.
            </p>
          </div>

          {/* Rights notice */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Rights Notice</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              The author donates all rights over this work to IU Internationale Hochschule for any
              academic purpose the institution considers appropriate. The source code may be used,
              adapted, or redistributed freely for academic and educational purposes.
            </p>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
