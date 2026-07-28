import React, { useState, useEffect } from 'react';

export const CountdownTimer = ({ lastPing, interval }: { lastPing: string | null; interval: number }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!lastPing) {
        setTimeLeft('Ping pertama...');
        return;
      }

      const nextPing = new Date(lastPing).getTime() + interval * 60000;
      const now = Date.now();
      const diff = nextPing - now;

      if (diff <= 0) {
        setTimeLeft('Ping sekarang...');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeLeft(`Berikutnya: ${minutes}m ${seconds}s`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [lastPing, interval]);

  return <span className="text-xs text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">{timeLeft}</span>;
};
