/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BookOpen, CheckCircle2, AlertCircle, Award, Clock, ArrowLeft, Check, X } from "lucide-react";
import { Quiz, QuizAttempt, User as AppUser, Department, Role, isTargetMatched } from "../types";

interface QuizzesProps {
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  activeUser: AppUser;
  onSubmitAttempt: (quizId: string, quizTitle: string, score: number, totalQuestions: number, answers: number[]) => void;
  onBack?: () => void;
}

export default function Quizzes({
  quizzes,
  attempts,
  activeUser,
  onSubmitAttempt,
  onBack
}: QuizzesProps) {
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: number }>({});
  const [submittedAttempt, setSubmittedAttempt] = useState<any | null>(null);
  const [errorMess, setErrorMess] = useState<string>("");

  // Filter quizzes by target role and department matching this employee
  const myQuizzes = quizzes.filter(q => {
    const matchDept = isTargetMatched(q.department, activeUser.department, Department.ALL);
    const matchRole = isTargetMatched(q.role, activeUser.role, Role.ALL);
    return matchDept && matchRole;
  });

  const myAttempts = attempts.filter(a => a.userId === activeUser.id);

  const handleSelectQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setSelectedAnswers({});
    setSubmittedAttempt(null);
    setErrorMess("");
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionId]: optionIdx
    });
  };

  const handleSubmitQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;

    // Check if all questions are answered
    const unanswered = selectedQuiz.questions.filter(q => selectedAnswers[q.id] === undefined);
    if (unanswered.length > 0) {
      setErrorMess(`Please answer all questions before submitting. (${unanswered.length} remaining)`);
      return;
    }

    setErrorMess("");
    
    // Calculate score
    let score = 0;
    const answersArray: number[] = [];
    selectedQuiz.questions.forEach(q => {
      const selectedOpt = selectedAnswers[q.id];
      answersArray.push(selectedOpt);
      if (selectedOpt === q.correctOptionIndex) {
        score++;
      }
    });

    onSubmitAttempt(selectedQuiz.id, selectedQuiz.title, score, selectedQuiz.questions.length, answersArray);
    
    setSubmittedAttempt({
      score,
      totalQuestions: selectedQuiz.questions.length,
      answers: answersArray
    });
  };

  return (
    <div className="space-y-4" id="quizzes-container">
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-555 hover:text-slate-800 transition-colors cursor-pointer select-none border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-xs self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      )}
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="text-amber-500 w-5 h-5" />
            Employee Knowledge Quizzes
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Complete assigned training assessments to verify shift workflow criteria.
          </p>
        </div>
      </div>

      {selectedQuiz ? (
        // TAKE QUIZ VIEW
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-md space-y-6">
          <button
            onClick={() => setSelectedQuiz(null)}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Quiz List
          </button>

          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800">{selectedQuiz.title}</h3>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">{selectedQuiz.description}</p>
          </div>

          {errorMess && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold">
              {errorMess}
            </div>
          )}

          {submittedAttempt ? (
            // RESULTS SCREEN
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-150 p-6 rounded-2xl text-center space-y-3">
                <Award className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="text-base font-bold text-emerald-900">Quiz Completed Successfully!</h4>
                <p className="text-2xl font-extrabold text-emerald-800">
                  {submittedAttempt.score} / {submittedAttempt.totalQuestions} Correct
                </p>
                <p className="text-xs text-emerald-700 font-semibold font-mono">
                  Score: {Math.round((submittedAttempt.score / submittedAttempt.totalQuestions) * 100)}%
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Review Questions</h4>
                {selectedQuiz.questions.map((q, qIdx) => {
                  const userAnsIdx = submittedAttempt.answers[qIdx];
                  const isCorrect = userAnsIdx === q.correctOptionIndex;

                  return (
                    <div key={q.id} className="p-4 rounded-xl border border-slate-100 space-y-2">
                      <p className="text-xs font-bold text-slate-850">
                        {qIdx + 1}. {q.questionText}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        {q.options.map((opt, optIdx) => {
                          const isUserSelected = userAnsIdx === optIdx;
                          const isCorrectOpt = q.correctOptionIndex === optIdx;

                          let optionClass = "bg-slate-50 border-slate-100 text-slate-600";
                          if (isUserSelected) {
                            optionClass = isCorrect 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold"
                              : "bg-red-50 border-red-200 text-red-900 font-semibold";
                          } else if (isCorrectOpt) {
                            optionClass = "bg-emerald-50/50 border-emerald-100 text-emerald-800 font-medium";
                          }

                          return (
                            <div key={optIdx} className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between ${optionClass}`}>
                              <span>{opt}</span>
                              {isUserSelected && (
                                isCorrect ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-red-600" />
                              )}
                              {!isUserSelected && isCorrectOpt && (
                                <Check className="w-3.5 h-3.5 text-emerald-600 opacity-60" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={() => setSelectedQuiz(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-50 text-xs font-semibold rounded-xl shadow-md cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            // FORM QUIZ QUESTIONS
            <form onSubmit={handleSubmitQuiz} className="space-y-6">
              <div className="space-y-4">
                {selectedQuiz.questions.map((q, qIdx) => (
                  <div key={q.id} className="p-4 rounded-xl border border-slate-100 space-y-3 bg-slate-50/30">
                    <p className="text-xs font-bold text-slate-850">
                      {qIdx + 1}. {q.questionText}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = selectedAnswers[q.id] === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectOption(q.id, optIdx)}
                            className={`p-3 rounded-xl border text-left text-[11px] transition-all flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? "bg-[#162D4E] border-[#162D4E] text-white font-semibold"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] shrink-0 ${
                              isSelected ? "border-white text-[#162D4E] bg-white font-bold" : "border-slate-300"
                            }`}>
                              {isSelected ? "✓" : optIdx + 1}
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedQuiz(null)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-855 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 border border-amber-500 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Submit Answers
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        // LIST OF QUIZZES
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Assigned Assessments</h3>

            {myQuizzes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 text-center py-12">
                <BookOpen className="mx-auto w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">No Quizzes Assigned</p>
                <p className="text-[10px] text-slate-400 mt-1">There are no knowledge checks assigned to your role or department.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myQuizzes.map(quiz => {
                  const hasAttempt = myAttempts.find(a => a.quizId === quiz.id);

                  return (
                    <div 
                      key={quiz.id}
                      className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[8px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded uppercase">
                            {quiz.department}
                          </span>
                          {hasAttempt && (
                            <span className="text-[8px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-850 leading-snug">{quiz.title}</h4>
                        <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{quiz.description}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-50 flex items-center justify-between mt-2">
                        <span className="text-[9px] text-slate-400 font-mono">
                          {quiz.questions.length} Questions
                        </span>
                        
                        <button
                          onClick={() => handleSelectQuiz(quiz)}
                          className={`px-3.5 py-1.5 font-semibold text-[10px] rounded-lg transition-colors cursor-pointer ${
                            hasAttempt
                              ? "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                              : "bg-[#162D4E] hover:bg-[#162D4E]/90 text-white font-bold"
                          }`}
                        >
                          {hasAttempt ? "Retake Assessment" : "Start Assessment"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SIDE PANEL: SCORE HISTORY */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 h-fit">
            <div className="border-b border-slate-50 pb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Your Quiz History
              </h3>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {myAttempts.length === 0 ? (
                <p className="text-[10px] text-slate-400 py-6 text-center">No assessments completed yet.</p>
              ) : (
                myAttempts.map(attempt => (
                  <div key={attempt.id} className="border-b border-slate-50 pb-2.5 text-left text-[11px] space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-slate-700 leading-tight block truncate flex-1">
                        {attempt.quizTitle}
                      </span>
                      <span className="text-[10px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-100 px-1 py-0.2 rounded shrink-0">
                        {attempt.score}/{attempt.totalQuestions}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono">
                      Done on {new Date(attempt.completedAt).toLocaleDateString()} at {new Date(attempt.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
