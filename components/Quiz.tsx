import React, { useState } from 'react';
import { QuizAnswers, SteamUser } from '../types.ts';

interface QuizProps {
  onComplete: (answers: QuizAnswers) => void;
  user?: SteamUser | null;
}

const GENRES = ['Action', 'RPG', 'Strategy', 'Indie', 'Adventure', 'Simulation', 'Horror', 'Puzzle', 'Sports', 'Racing'];

const Quiz: React.FC<QuizProps> = ({ onComplete, user }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({
    preferredGenres: [],
    playstyle: 'balanced',
    timeAvailability: 'medium',
    specificKeywords: '',
    difficultyPreference: 'normal',
    excludeOwned: false,
  });

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const toggleGenre = (genre: string) => {
    setAnswers(prev => ({
      ...prev,
      preferredGenres: prev.preferredGenres.includes(genre)
        ? prev.preferredGenres.filter(g => g !== genre)
        : [...prev.preferredGenres, genre]
    }));
  };

  return (
    <div className="max-w-2xl mx-auto steam-card p-8 rounded-xl shadow-2xl quiz-fade-in">
      <div className="mb-8">
        <div className="flex justify-between text-xs font-black text-[#66c0f4] mb-3 tracking-widest uppercase">
          <span>Phase {step + 1} of 4</span>
          <span>{Math.round(((step + 1) / 4) * 100)}% Synchronized</span>
        </div>
        <div className="w-full bg-gray-800/50 h-1.5 rounded-full overflow-hidden border border-white/5">
          <div 
            className="h-full transition-all duration-500 ease-out"
            style={{ 
              width: `${((step + 1) / 4) * 100}%`,
              background: 'linear-gradient(to right, #1a3a5c, #66c0f4)'
            }}
          ></div>
        </div>
      </div>

      <div className="min-h-[300px]">
        {step === 0 && (
          <div className="quiz-step-fade" key="step-0">
            <h2 className="text-3xl font-black mb-2 text-white uppercase tracking-tight">Select Categories</h2>
            <p className="text-gray-300 mb-8 text-sm">Choose the genres that define your typical library.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {GENRES.map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`p-3 rounded-sm border text-xs font-bold transition-all duration-200 uppercase tracking-wider ${
                    answers.preferredGenres.includes(genre)
                      ? 'bg-[#1a3a5c] border-[#66c0f4] text-[#66c0f4] shadow-lg shadow-[#66c0f4]/20 scale-[1.02]'
                      : 'bg-gray-800/30 border-white/5 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="quiz-step-fade" key="step-1">
            <h2 className="text-3xl font-black mb-2 text-white uppercase tracking-tight">Playstyle Profile</h2>
            <p className="text-gray-300 mb-8 text-sm">How do you prefer to interact with game mechanics?</p>
            <div className="space-y-4 mb-8">
              {['casual', 'balanced', 'hardcore'].map((style) => (
                <button
                  key={style}
                  onClick={() => setAnswers({...answers, playstyle: style as any})}
                  className={`w-full p-5 rounded-sm border text-left transition-all group ${
                    answers.playstyle === style
                      ? 'bg-[#1a3a5c] border-[#66c0f4] text-white'
                      : 'bg-gray-800/30 border-white/5 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className={`capitalize font-black text-lg mb-1 tracking-tight ${answers.playstyle === style ? 'text-white' : 'group-hover:text-gray-300'}`}>
                    {style}
                  </div>
                  <div className="text-xs opacity-70 font-medium">
                    {style === 'casual' && "Focus on relaxation, aesthetics, and low-friction storytelling."}
                    {style === 'balanced' && "Enjoy meaningful challenges with a steady learning curve."}
                    {style === 'hardcore' && "Demand precision, depth, and punishingly rewarding mastery."}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="quiz-step-fade" key="step-2">
            <h2 className="text-3xl font-black mb-2 text-white uppercase tracking-tight">Temporal Allocation</h2>
            <p className="text-gray-300 mb-8 text-sm">How much time can you commit to a single title?</p>
            <div className="grid grid-cols-1 gap-4 mb-8">
              {[
                { id: 'short', label: 'Bite-Sized (< 15 hrs)', desc: 'High-impact, concise experiences that respect your time.' },
                { id: 'medium', label: 'Standard (15 - 50 hrs)', desc: 'Deep narratives or systems designed for several weeks of play.' },
                { id: 'long', label: 'Epic (50+ hrs)', desc: 'Infinite loops or massive worlds for long-term immersion.' }
              ].map((time) => (
                <button
                  key={time.id}
                  onClick={() => setAnswers({...answers, timeAvailability: time.id as any})}
                  className={`p-5 rounded-sm border text-left transition-all ${
                    answers.timeAvailability === time.id
                      ? 'bg-[#1a3a5c] border-[#66c0f4] text-white'
                      : 'bg-gray-800/30 border-white/5 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="font-black text-lg tracking-tight uppercase">{time.label}</div>
                  <div className="text-xs opacity-70 font-medium">{time.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="quiz-step-fade" key="step-3">
            <h2 className="text-3xl font-black mb-2 text-white uppercase tracking-tight">Specific Directives</h2>
            <p className="text-gray-300 mb-8 text-sm">Mention themes, settings, or specific 'vibes' (e.g., Cyberpunk, Retro, Dark).</p>
            <textarea
              className="w-full bg-black/40 border border-white/10 rounded-sm p-5 text-white focus:outline-none focus:border-blue-500 mb-6 h-40 font-medium placeholder:text-gray-700 transition-colors"
              placeholder="E.g. I want something with a deep loot system and a depressing atmosphere..."
              value={answers.specificKeywords}
              onChange={(e) => setAnswers({...answers, specificKeywords: e.target.value})}
            />
            {/* Exclude owned games option */}
            {user ? (
              <label className="flex items-center gap-3 cursor-pointer p-4 bg-white/5 border border-white/10 rounded-lg hover:border-blue-500/30 transition-colors">
                <input
                  type="checkbox"
                  checked={!!answers.excludeOwned}
                  onChange={(e) => setAnswers({...answers, excludeOwned: e.target.checked})}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className="text-sm font-semibold text-gray-300">
                  Exclude games I already own from my recommendations
                </span>
              </label>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-sm font-medium">
                <span className="text-blue-400">ℹ</span>
                <span>
                  <a href="/api/auth/steam" className="text-blue-400 hover:text-blue-300 underline transition-colors" rel="noopener noreferrer">Log in with Steam</a>
                  {' '}to exclude games you already own!
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-white/5">
        {step > 0 ? (
          <button 
            onClick={prevStep}
            className="px-8 py-3 text-xs font-black text-gray-400 hover:text-white transition-colors uppercase tracking-widest"
          >
            Previous
          </button>
        ) : (
          <div></div>
        )}
        
        {step < 3 ? (
          <button 
            onClick={nextStep}
            disabled={step === 0 && answers.preferredGenres.length === 0}
            className={`px-10 py-4 rounded-sm font-black text-sm uppercase tracking-widest transition-all ${
              step === 0 && answers.preferredGenres.length === 0
              ? 'bg-gray-800 cursor-not-allowed text-gray-600'
              : 'bg-[#66c0f4] hover:bg-[#00d2ff] text-[#0d1117] shadow-xl shadow-[#66c0f4]/20 active:scale-95'
            }`}
          >
            Advance
          </button>
        ) : (
          <button 
            onClick={() => onComplete(answers)}
            className="px-12 py-4 bg-[#66c0f4] hover:bg-[#00d2ff] text-[#0d1117] rounded-sm font-black text-sm uppercase tracking-widest shadow-2xl shadow-[#66c0f4]/30 transition-all active:scale-95"
          >
            Initialize Recommendations
          </button>
        )}
      </div>
    </div>
  );
};

export default Quiz;
