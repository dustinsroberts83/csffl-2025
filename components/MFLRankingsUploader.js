// components/MFLRankingsUploader.js
import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function MFLRankingsUploader({ leagueId = '37306' }) {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [rankingsText, setRankingsText] = useState('');

  const parseRankingsText = (text) => {
    const rankings = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Skip empty lines and headers
      if (!line.trim() || line.includes('RANK') || line.includes('PLAYER')) continue;
      
      // More flexible regex pattern that handles various formats
      // Matches: "1 McCaffrey, Christian SFO RB FA (Locked)" or similar variations
      const match = line.match(/^(\d+)\s+(.+?)\s+([A-Z]{2,3})\s+([A-Z]{1,3})\s+FA\s*(.*)$/);
      
      if (match) {
        const [_, rank, name, team, position, status] = match;
        
        // Clean up the name (remove extra spaces)
        const cleanName = name.trim().replace(/\s+/g, ' ');
        
        rankings.push({
          rank: parseInt(rank),
          name: cleanName,
          position: position.trim(),
          team: team.trim(),
          status: status ? status.trim() : null
        });
      } else {
        // Try alternative format without clear separation
        // This handles cases where the parser might struggle with team/position boundaries
        const altMatch = line.match(/^(\d+)\s+([^0-9]+?)\s+([A-Z]{2,3})\s+([A-Z]{1,3})\s+/);
        if (altMatch) {
          const [_, rank, nameAndTeam, possibleTeam, position] = altMatch;
          
          // Extract the actual name by looking for common patterns
          let name = nameAndTeam;
          let team = possibleTeam;
          
          // Check if the "team" might actually be part of the name
          if (nameAndTeam.match(/[A-Z]{2,3}$/)) {
            // Team code is at the end of the name section
            const parts = nameAndTeam.match(/(.+?)\s+([A-Z]{2,3})$/);
            if (parts) {
              name = parts[1];
              team = parts[2];
            }
          }
          
          rankings.push({
            rank: parseInt(rank),
            name: name.trim().replace(/\s+/g, ' '),
            position: position.trim(),
            team: team.trim(),
            status: line.includes('(Locked)') ? '(Locked)' : null
          });
        }
      }
    }
    
    console.log(`Parsed ${rankings.length} rankings`);
    console.log('Sample:', rankings.slice(0, 5));
    
    return rankings;
  };

  const handleUpload = async () => {
    if (!rankingsText.trim()) {
      setUploadStatus({ type: 'error', message: 'Please paste rankings data' });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      // Parse the pasted text
      const rankings = parseRankingsText(rankingsText);
      
      if (rankings.length === 0) {
        throw new Error('No valid rankings found in the pasted text');
      }

      // Upload to database
      const response = await fetch('/api/upload-mfl-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rankings,
          leagueId,
          year: 2025
        })
      });

      const result = await response.json();

      if (result.success) {
        setUploadStatus({
          type: 'success',
          message: `Successfully uploaded ${result.stats.inserted} MFL rankings!`
        });
        setRankingsText('');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        type: 'error',
        message: error.message
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteRankings = async () => {
    if (!confirm('Are you sure you want to delete all MFL rankings? This cannot be undone.')) {
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const response = await fetch('/api/upload-mfl-rankings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          year: 2025
        })
      });

      const result = await response.json();

      if (result.success) {
        setUploadStatus({
          type: 'success',
          message: 'All MFL rankings have been deleted.'
        });
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      setUploadStatus({
        type: 'error',
        message: error.message
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-2xl mx-auto">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload MFL Rankings</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Paste MFL Rankings Data
          </label>
          <textarea
            value={rankingsText}
            onChange={(e) => setRankingsText(e.target.value)}
            placeholder="Paste the rankings data here (format: rank name team position status)..."
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono"
          />
          <p className="mt-1 text-xs text-gray-500">
            Expected format: 1 McCaffrey, Christian SFO RB FA (Locked) - one player per line
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleUpload}
            disabled={isUploading || !rankingsText.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Upload className="animate-spin" size={16} />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload Rankings
              </>
            )}
          </button>

          <button
            onClick={() => setRankingsText('')}
            disabled={isUploading || !rankingsText}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            Clear
          </button>

          <button
            onClick={handleDeleteRankings}
            disabled={isUploading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <X size={16} />
            Delete All Rankings
          </button>
        </div>

        {uploadStatus && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            uploadStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {uploadStatus.type === 'success' ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {uploadStatus.message}
          </div>
        )}
      </div>

      {/* Sample Data Format */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Sample Format:</h4>
        <pre className="text-xs text-gray-600 font-mono">
{`1 McCaffrey, Christian SFO RB FA (Locked)
2 Hill, Tyreek MIA WR FA (Locked)
3 Moore, D.J. CHI WR FA (Locked)
4 Godwin, Chris TBB WR FA (Locked) Out
5 Jennings, Jauan SFO WR FA (Locked) Questionable
6 Thielen, Adam CAR WR FA (Locked)
7 Robinson, Wan'Dale NYG WR FA (Locked) Questionable
8 Pierce, Alec IND WR FA (Locked)
9 Kelce, Travis KCC TE FA (Locked)
10 Mooney, Darnell ATL WR FA (Locked) Questionable`}
        </pre>
      </div>
    </div>
  );
}