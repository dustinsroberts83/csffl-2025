import React from 'react';

export default function SalaryCapDebug({ rosters, teamName = "D'Justin" }) {
  const roster = rosters?.find(r => r.name === teamName || r.name === "D'Justin");
  
  if (!roster) {
    return <div>Team not found</div>;
  }
  
  const players = roster.player ? 
    (Array.isArray(roster.player) ? roster.player : [roster.player]) : [];
  
  let activeRosterSalary = 0;
  let taxiSquadSalary = 0;
  let irSalary = 0;
  const salaryBreakdown = [];
  
  players.forEach(player => {
    const playerObj = typeof player === 'object' ? player : { id: player };
    const salary = parseFloat(playerObj.salary || 0);
    const status = playerObj.status || 'ROSTER';
    
    salaryBreakdown.push({
      id: playerObj.id,
      salary: salary,
      status: status
    });
    
    if (status === 'TAXI_SQUAD') {
      taxiSquadSalary += salary;
    } else if (status === 'INJURED_RESERVE') {
      irSalary += salary;
    } else {
      activeRosterSalary += salary;
    }
  });
  
  const totalSalary = activeRosterSalary + taxiSquadSalary + irSalary;
  const capSpace = 500 - activeRosterSalary; // Usually only active roster counts
  const totalCapSpace = 500 - totalSalary; // If all players count
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Salary Cap Debug for {teamName}</h2>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Salary Breakdown</h3>
            <div className="space-y-1 text-sm">
              <div>Active Roster: ${activeRosterSalary.toFixed(2)}</div>
              <div>Taxi Squad: ${taxiSquadSalary.toFixed(2)}</div>
              <div>IR: ${irSalary.toFixed(2)}</div>
              <div className="font-bold border-t pt-1">
                Total: ${totalSalary.toFixed(2)}
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Cap Space</h3>
            <div className="space-y-1 text-sm">
              <div>Salary Cap: $500.00</div>
              <div>Used (Active Only): ${activeRosterSalary.toFixed(2)}</div>
              <div className="font-bold text-green-600">
                Remaining: ${capSpace.toFixed(2)}
              </div>
              <div className="text-xs text-gray-600 mt-2">
                If all count: ${totalCapSpace.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">All Players ({players.length} total)</h3>
          <div className="text-xs space-y-1 max-h-64 overflow-y-auto">
            {salaryBreakdown.map((player, idx) => (
              <div key={idx} className="flex justify-between py-1 border-b">
                <span>Player ID: {player.id}</span>
                <span>${player.salary.toFixed(2)}</span>
                <span className="text-gray-600">{player.status}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded">
          <h3 className="font-semibold mb-2">What MFL Shows</h3>
          <div className="text-sm space-y-1">
            <div>Total Salary: $197.00</div>
            <div>Cap Room: $303.00</div>
            <div className="font-bold text-red-600 mt-2">
              Discrepancy: ${(activeRosterSalary - 197).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}