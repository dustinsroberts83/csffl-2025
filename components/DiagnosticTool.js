import { useState } from 'react';
import { Download, Search, AlertCircle } from 'lucide-react';

export default function DiagnosticTool({ leagueId }) {
  const [loading, setLoading] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState(null);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/diagnostic-export?leagueId=${leagueId}`);
      const data = await response.json();
      setDiagnosticData(data);
    } catch (error) {
      console.error('Diagnostic failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    window.open(`/api/diagnostic-export?leagueId=${leagueId}&format=csv`, '_blank');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Name Matching Diagnostic</h3>
      
      <div className="space-y-4">
        <div className="flex gap-3">
          <button
            onClick={runDiagnostic}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>Loading...</>
            ) : (
              <>
                <Search size={16} />
                Run Diagnostic
              </>
            )}
          </button>
          
          {diagnosticData && (
            <button
              onClick={downloadCSV}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
            >
              <Download size={16} />
              Download CSV
            </button>
          )}
        </div>

        {diagnosticData && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Summary</h4>
              <p className="text-sm text-blue-800">
                MFL Free Agents (on NFL teams): {diagnosticData.summary.mflFreeAgentsCount}<br />
                FantasyPros Players (on NFL teams): {diagnosticData.summary.fantasyProsPlayersCount}
              </p>
            </div>

            {diagnosticData.unmatchedSamples.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <h4 className="font-semibold text-gray-900 p-3 bg-gray-50">
                  Unmatched Sample Analysis
                </h4>
                <div className="max-h-96 overflow-y-auto">
                  {diagnosticData.unmatchedSamples.map((sample, idx) => (
                    <div key={idx} className="border-t border-gray-200 p-3 text-sm">
                      <div className="font-medium text-gray-900">
                        MFL: {sample.mfl.name} ({sample.mfl.position} - {sample.mfl.team})
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Normalized: "{sample.mfl.normalized}"
                      </div>
                      {sample.closeMatches.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-gray-700">Possible matches in FantasyPros:</div>
                          {sample.closeMatches.map((match, i) => (
                            <div key={i} className="text-xs text-gray-600 ml-3">
                              • {match.name} ({match.position} - {match.team}) → "{match.normalized}"
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}