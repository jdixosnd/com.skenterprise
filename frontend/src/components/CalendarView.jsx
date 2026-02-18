import { useState, useMemo } from 'react';
import { Icons } from '../constants/icons';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from 'date-fns';
import '../styles/CalendarView.css';

const CalendarView = ({ programs, inwardLots, bills }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // Debug logging
  console.log('CalendarView - Programs:', programs?.length || 0);
  console.log('CalendarView - InwardLots:', inwardLots?.length || 0);
  console.log('CalendarView - Bills:', bills?.length || 0);

  // Calculate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the day of week for the first day (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = monthStart.getDay();

  // Group programs, inward lots, and bills by date
  const eventsByDate = useMemo(() => {
    const events = {};

    // Add programs
    if (programs && programs.length > 0) {
      programs.forEach(program => {
        try {
          const date = program.created_at instanceof Date ? program.created_at : new Date(program.created_at);
          const dateKey = format(date, 'yyyy-MM-dd');
          if (!events[dateKey]) {
            events[dateKey] = { programs: [], inwardLots: [], bills: [] };
          }
          events[dateKey].programs.push(program);
        } catch (error) {
          console.error('Error parsing program date:', error, program);
        }
      });
    }

    // Add inward lots
    if (inwardLots && inwardLots.length > 0) {
      inwardLots.forEach(lot => {
        try {
          const date = lot.created_at instanceof Date ? lot.created_at : new Date(lot.created_at);
          const dateKey = format(date, 'yyyy-MM-dd');
          if (!events[dateKey]) {
            events[dateKey] = { programs: [], inwardLots: [], bills: [] };
          }
          events[dateKey].inwardLots.push(lot);
        } catch (error) {
          console.error('Error parsing lot date:', error, lot);
        }
      });
    }

    // Add bills
    if (bills && bills.length > 0) {
      bills.forEach(bill => {
        try {
          const date = bill.created_at instanceof Date ? bill.created_at : new Date(bill.created_at);
          const dateKey = format(date, 'yyyy-MM-dd');
          if (!events[dateKey]) {
            events[dateKey] = { programs: [], inwardLots: [], bills: [] };
          }
          events[dateKey].bills.push(bill);
        } catch (error) {
          console.error('Error parsing bill date:', error, bill);
        }
      });
    }

    console.log('CalendarView - Events by date:', events);
    return events;
  }, [programs, inwardLots, bills, currentDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  const handleDateClick = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    if (eventsByDate[dateKey]) {
      setSelectedDate(selectedDate && isSameDay(selectedDate, date) ? null : date);
    }
  };

  const getEventsForDate = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return eventsByDate[dateKey] || { programs: [], inwardLots: [], bills: [] };
  };

  const renderCalendarDays = () => {
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Add days of the month
    daysInMonth.forEach(date => {
      const events = getEventsForDate(date);
      const hasEvents = events.programs.length > 0 || events.inwardLots.length > 0 || events.bills.length > 0;
      const isToday = isSameDay(date, new Date());
      const isSelected = selectedDate && isSameDay(date, selectedDate);

      days.push(
        <div
          key={date.toString()}
          className={`calendar-day ${hasEvents ? 'has-events' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => handleDateClick(date)}
        >
          <div className="day-number">{format(date, 'd')}</div>
          {hasEvents && (
            <div className="event-indicators">
              {events.inwardLots.length > 0 && (
                <div className="indicator inward-indicator" title={`${events.inwardLots.length} Inward Lot${events.inwardLots.length > 1 ? 's' : ''}`}>
                  <Icons.Download size={8} />
                  <span>{events.inwardLots.length}</span>
                </div>
              )}
              {events.programs.length > 0 && (
                <div className="indicator program-indicator" title={`${events.programs.length} Program${events.programs.length > 1 ? 's' : ''}`}>
                  <Icons.Package size={8} />
                  <span>{events.programs.length}</span>
                </div>
              )}
              {events.bills.length > 0 && (
                <div className="indicator bill-indicator" title={`${events.bills.length} Bill${events.bills.length > 1 ? 's' : ''}`}>
                  <Icons.Document size={8} />
                  <span>{events.bills.length}</span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    });

    return days;
  };

  const renderSelectedDateDetails = () => {
    if (!selectedDate) return null;

    const events = getEventsForDate(selectedDate);
    if (events.programs.length === 0 && events.inwardLots.length === 0 && events.bills.length === 0) return null;

    return (
      <div className="date-details-panel">
        <div className="date-details-header">
          <h3>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>
          <button className="btn-close-details" onClick={() => setSelectedDate(null)}>
            <Icons.Close size={14} />
          </button>
        </div>

        <div className="date-details-content">
          {events.inwardLots.length > 0 && (
            <div className="details-section">
              <h4>
                <Icons.Download size={14} />
                Inward Lots ({events.inwardLots.length})
              </h4>
              <div className="details-list">
                {events.inwardLots.map(lot => (
                  <div key={lot.id} className="detail-item">
                    <div className="detail-primary">
                      <span className="lot-number">{lot.lot_number}</span>
                      <span className="lot-party">{lot.party_name}</span>
                    </div>
                    <div className="detail-secondary">
                      <span>{lot.quality_name}</span>
                      <span className="meters">{parseFloat(lot.total_meters).toFixed(2)}m</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.programs.length > 0 && (
            <div className="details-section">
              <h4>
                <Icons.Package size={14} />
                Programs ({events.programs.length})
              </h4>
              <div className="details-list">
                {events.programs.map(program => (
                  <div key={program.id} className="detail-item">
                    <div className="detail-primary">
                      <span className="program-number">{program.program_number}</span>
                      <span className="design-number">Design: {program.design_number}</span>
                    </div>
                    <div className="detail-secondary">
                      <span>Input: {parseFloat(program.input_meters).toFixed(2)}m</span>
                      <span>Output: {parseFloat(program.output_meters).toFixed(2)}m</span>
                      <span className={`status-badge status-${program.status.toLowerCase()}`}>
                        {program.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.bills.length > 0 && (
            <div className="details-section">
              <h4>
                <Icons.Document size={14} />
                Bills ({events.bills.length})
              </h4>
              <div className="details-list">
                {events.bills.map(bill => (
                  <div key={bill.id} className="detail-item">
                    <div className="detail-primary">
                      <span className="program-number">Bill #{bill.bill_number}</span>
                      <span className="design-number">{bill.party_name}</span>
                    </div>
                    <div className="detail-secondary">
                      <span>Total: ₹{parseFloat(bill.grand_total).toFixed(2)}</span>
                      <span>{bill.program_count} Program{bill.program_count > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Calculate monthly statistics
  const monthlyStats = useMemo(() => {
    const monthStartKey = format(monthStart, 'yyyy-MM-dd');
    const monthEndKey = format(monthEnd, 'yyyy-MM-dd');

    let programCount = 0;
    let inwardCount = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalInward = 0;

    if (programs && programs.length > 0) {
      programs.forEach(program => {
        try {
          const date = program.created_at instanceof Date ? program.created_at : new Date(program.created_at);
          const dateKey = format(date, 'yyyy-MM-dd');
          if (dateKey >= monthStartKey && dateKey <= monthEndKey) {
            programCount++;
            totalInput += parseFloat(program.input_meters) || 0;
            totalOutput += parseFloat(program.output_meters) || 0;
          }
        } catch (error) {
          console.error('Error parsing program date in stats:', error);
        }
      });
    }

    if (inwardLots && inwardLots.length > 0) {
      inwardLots.forEach(lot => {
        try {
          const date = lot.created_at instanceof Date ? lot.created_at : new Date(lot.created_at);
          const dateKey = format(date, 'yyyy-MM-dd');
          if (dateKey >= monthStartKey && dateKey <= monthEndKey) {
            inwardCount++;
            totalInward += parseFloat(lot.total_meters) || 0;
          }
        } catch (error) {
          console.error('Error parsing lot date in stats:', error);
        }
      });
    }

    let billCount = 0;
    let totalBillAmount = 0;

    if (bills && bills.length > 0) {
      bills.forEach(bill => {
        try {
          const date = bill.created_at instanceof Date ? bill.created_at : new Date(bill.created_at);
          const dateKey = format(date, 'yyyy-MM-dd');
          if (dateKey >= monthStartKey && dateKey <= monthEndKey) {
            billCount++;
            totalBillAmount += parseFloat(bill.grand_total) || 0;
          }
        } catch (error) {
          console.error('Error parsing bill date in stats:', error);
        }
      });
    }

    return {
      programCount,
      inwardCount,
      totalInput,
      totalOutput,
      totalInward,
      billCount,
      totalBillAmount,
      wastage: totalInput - totalOutput
    };
  }, [programs, inwardLots, bills, currentDate]);

  return (
    <div className="calendar-view-container">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button onClick={goToPreviousMonth} className="btn btn-sm btn-secondary">
            <Icons.ChevronLeft size={14} />
          </button>
          <h2 className="current-month">{format(currentDate, 'MMMM yyyy')}</h2>
          <button onClick={goToNextMonth} className="btn btn-sm btn-secondary">
            <Icons.ChevronRight size={14} />
          </button>
          <button onClick={goToToday} className="btn btn-sm btn-primary">
            Today
          </button>
        </div>

        <div className="monthly-stats">
          <div className="stat-item">
            <Icons.Download size={14} />
            <span className="stat-value">{monthlyStats.inwardCount}</span>
            <span className="stat-label">Inward Lots</span>
            <span className="stat-detail">{monthlyStats.totalInward.toFixed(2)}m</span>
          </div>
          <div className="stat-item">
            <Icons.Package size={14} />
            <span className="stat-value">{monthlyStats.programCount}</span>
            <span className="stat-label">Programs</span>
            <span className="stat-detail">{monthlyStats.totalOutput.toFixed(2)}m output</span>
          </div>
          <div className="stat-item">
            <Icons.Document size={14} />
            <span className="stat-value">{monthlyStats.billCount}</span>
            <span className="stat-label">Bills</span>
            <span className="stat-detail">₹{monthlyStats.totalBillAmount.toFixed(2)}</span>
          </div>
          {monthlyStats.programCount > 0 && (
            <div className="stat-item">
              <Icons.TrendingDown size={14} />
              <span className="stat-value">{((monthlyStats.wastage / monthlyStats.totalInput) * 100).toFixed(1)}%</span>
              <span className="stat-label">Wastage</span>
              <span className="stat-detail">{monthlyStats.wastage.toFixed(2)}m</span>
            </div>
          )}
        </div>
      </div>

      <div className="calendar-layout">
        <div className="calendar-grid-container">
          <div className="calendar-weekdays">
            <div className="weekday">Sun</div>
            <div className="weekday">Mon</div>
            <div className="weekday">Tue</div>
            <div className="weekday">Wed</div>
            <div className="weekday">Thu</div>
            <div className="weekday">Fri</div>
            <div className="weekday">Sat</div>
          </div>
          <div className="calendar-grid">
            {renderCalendarDays()}
          </div>
        </div>

        {renderSelectedDateDetails()}
      </div>
    </div>
  );
};

export default CalendarView;
