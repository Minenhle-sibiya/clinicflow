import { useEffect, useState } from 'react';

const DEMO_DATE = '2026-09-16';
const emptyPatient = { fullName: '', phone: '', dateOfBirth: '' };
const emptyBooking = {
  patientId: '',
  staffId: '',
  startsAt: `${DEMO_DATE}T09:00`,
  endsAt: `${DEMO_DATE}T09:30`,
  reason: '',
};

export default function App() {
  const [activePage, setActivePage] = useState('receptionist');
  const [date, setDate] = useState(DEMO_DATE);
  const [patientSearch, setPatientSearch] = useState('');
  const [data, setData] = useState({ patients: [], staff: [], appointments: [] });
  const [patient, setPatient] = useState(emptyPatient);
  const [booking, setBooking] = useState(emptyBooking);
  const [reschedule, setReschedule] = useState(null);
  const [message, setMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const role = activePage === 'clinician' ? 'Clinician' : 'Receptionist';

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const response = await fetch(
          `/api/data?date=${encodeURIComponent(date)}`,
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setData(body);
      } catch (error) {
        if (active) setMessage(error.message || 'Could not load ClinicFlow.');
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [date, refreshKey]);

  async function request(path, options) {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': role,
      },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Request failed.');
    return body;
  }

  function refresh(successMessage) {
    setMessage(successMessage);
    setRefreshKey((value) => value + 1);
  }

  async function submitPatient(event) {
    event.preventDefault();
    try {
      await request('/api/patients', {
        method: 'POST',
        body: JSON.stringify(patient),
      });
      setPatient(emptyPatient);
      refresh('Fictional patient added.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitBooking(event) {
    event.preventDefault();
    try {
      await request('/api/appointments', {
        method: 'POST',
        body: JSON.stringify(booking),
      });
      setBooking((current) => ({ ...current, reason: '' }));
      refresh('Appointment booked.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateStatus(id, status) {
    try {
      await request(`/api/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      refresh(`Appointment marked ${status}.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitReschedule(event) {
    event.preventDefault();
    try {
      await request(`/api/appointments/${reschedule.id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify(reschedule),
      });
      setReschedule(null);
      refresh('Appointment rescheduled.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  const patientMatches = data.patients.filter((item) => {
    const term = patientSearch.toLowerCase();
    return item.fullName.toLowerCase().includes(term) || item.phone.includes(term);
  });

  const scheduled = data.appointments.filter((item) => item.status === 'Scheduled').length;
  const waiting = data.appointments.filter((item) => item.status === 'Arrived').length;
  const completed = data.appointments.filter((item) => item.status === 'Completed').length;

  const calendarPage = activePage === 'receptionist' || activePage === 'clinician';
  const pageTitle = {
    receptionist: 'Patient calendar',
    clinician: 'Clinician calendar',
    'add-patient': 'Add a fictional client',
    booking: 'Book appointment',
    records: 'Patient records',
  }[activePage];

  function renderAppointmentTable(title, appointments, showActions = true) {
    return (
      <section className="card">
        <h2>{title}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th><th>Patient</th><th>Clinician</th><th>Reason</th><th>Status</th>
                {showActions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td>{appointment.startTime} to {appointment.endTime}</td>
                  <td>{appointment.patientName}<small>{appointment.phone}</small></td>
                  <td>{appointment.staffName}</td>
                  <td>{appointment.reason}</td>
                  <td><span className={`badge ${appointment.status.toLowerCase().replaceAll(' ', '-')}`}>{appointment.status}</span></td>
                  {showActions && (
                    <td className="actions">
                      {role === 'Receptionist' ? (
                        <>
                          <button onClick={() => updateStatus(appointment.id, 'Arrived')}>Arrived</button>
                          <button onClick={() => setReschedule({
                            id: appointment.id,
                            staffId: String(appointment.staffId),
                            startsAt: appointment.startsAt,
                            endsAt: appointment.endsAt,
                          })}>Reschedule</button>
                          <button className="danger" onClick={() => updateStatus(appointment.id, 'Cancelled')}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => updateStatus(appointment.id, 'In Consultation')}>Start visit</button>
                          <button onClick={() => updateStatus(appointment.id, 'Completed')}>Complete</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!appointments.length && <tr><td colSpan={showActions ? 6 : 5}>No matching appointments.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderCalendar() {
    if (role === 'Clinician') {
      const clinicianAppointments = data.appointments.filter((item) => item.status !== 'Completed');
      const completedAppointments = data.appointments.filter((item) => item.status === 'Completed');

      return (
        <>
          {renderAppointmentTable('Appointments', clinicianAppointments)}
          {renderAppointmentTable('Completed appointments', completedAppointments, false)}
        </>
      );
    }

    return renderAppointmentTable('Patient calendar', data.appointments);
  }

  function renderBookingForm() {
    return (
      <form className="card form-panel" onSubmit={submitBooking}>
        <h2>Book appointment</h2>
        <label>Patient
          <select required value={booking.patientId} onChange={(event) => setBooking({ ...booking, patientId: event.target.value })}>
            <option value="">Choose a patient</option>
            {data.patients.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
          </select>
        </label>
        <label>Clinician
          <select required value={booking.staffId} onChange={(event) => setBooking({ ...booking, staffId: event.target.value })}>
            <option value="">Choose a clinician</option>
            {data.staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
          </select>
        </label>
        <label>Starts<input required type="datetime-local" value={booking.startsAt} onChange={(event) => setBooking({ ...booking, startsAt: event.target.value })} /></label>
        <label>Ends<input required type="datetime-local" value={booking.endsAt} onChange={(event) => setBooking({ ...booking, endsAt: event.target.value })} /></label>
        <label>Reason<input required value={booking.reason} onChange={(event) => setBooking({ ...booking, reason: event.target.value })} /></label>
        <button className="primary" type="submit">Confirm booking</button>
      </form>
    );
  }

  function renderPatientForm() {
    return (
      <form className="card form-panel" onSubmit={submitPatient}>
        <h2>Add a fictional client</h2>
        <label>Full name<input required value={patient.fullName} onChange={(event) => setPatient({ ...patient, fullName: event.target.value })} /></label>
        <label>Phone<input required value={patient.phone} onChange={(event) => setPatient({ ...patient, phone: event.target.value })} /></label>
        <label>Date of birth<input required type="date" value={patient.dateOfBirth} onChange={(event) => setPatient({ ...patient, dateOfBirth: event.target.value })} /></label>
        <button className="primary" type="submit">Add client</button>
      </form>
    );
  }

  function renderPatientRecords() {
    return (
      <>
        <label className="records-search">Search patient records
          <input
            type="search"
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.target.value)}
            placeholder="Name or phone"
          />
        </label>
        <section className="patient-list">
          {patientMatches.map((item) => (
            <article key={item.id}>
              <strong>{item.fullName}</strong>
              <span>{item.phone}</span>
              <span>DOB: {item.dateOfBirth}</span>
            </article>
          ))}
          {!patientMatches.length && <p>No matching fictional patients.</p>}
        </section>
      </>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <a className="brand" href="#receptionist" onClick={() => setActivePage('receptionist')}>
          <span className="brand-mark">C</span>
          <span>ClinicFlow<small>Clinic workspace</small></span>
        </a>
        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <button className={`nav-link ${activePage === 'clinician' ? 'active' : ''}`} onClick={() => setActivePage('clinician')}>
            Clinician
          </button>
          <p className="nav-label receptionist-label">Receptionist</p>
          <button className={`nav-link ${activePage === 'receptionist' ? 'active' : ''}`} onClick={() => setActivePage('receptionist')}>
            Patient calendar
          </button>
          <button className={`nav-link sub-link ${activePage === 'add-patient' ? 'active' : ''}`} onClick={() => setActivePage('add-patient')}>
            Add a fictional client
          </button>
          <button className={`nav-link sub-link ${activePage === 'booking' ? 'active' : ''}`} onClick={() => setActivePage('booking')}>
            Book appointment
          </button>
          <button className={`nav-link sub-link ${activePage === 'records' ? 'active' : ''}`} onClick={() => setActivePage('records')}>
            Patient records
          </button>
        </nav>
        <p className="sidebar-foot">Fictional data only</p>
      </aside>

      <main className="shell">
        <header className="page-header">
          <div>
            <p className="eyebrow">{role} workspace</p>
            <h1>{pageTitle}</h1>
          </div>
          {calendarPage && (
            <label className="date-picker">Schedule date
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setDate(nextDate);
                  setBooking((current) => ({
                    ...current,
                    startsAt: `${nextDate}T09:00`,
                    endsAt: `${nextDate}T09:30`,
                  }));
                }}
              />
            </label>
          )}
        </header>

        <p className="notice">This learning prototype is not production authentication and must not contain real patient data.</p>
        {message && <p className="message" aria-live="polite">{message}</p>}

        {calendarPage && (
          <>
            <section className="metrics">
              <article className="card"><strong>{data.appointments.length}</strong><span>Total today</span></article>
              <article className="card"><strong>{scheduled}</strong><span>Scheduled</span></article>
              <article className="card"><strong>{waiting}</strong><span>Waiting</span></article>
              <article className="card"><strong>{completed}</strong><span>Completed</span></article>
            </section>
            {renderCalendar()}
            {role === 'Receptionist' && reschedule && (
              <form className="card" onSubmit={submitReschedule}>
                <h2>Reschedule appointment #{reschedule.id}</h2>
                <div className="form-grid">
                  <label>Clinician
                    <select required value={reschedule.staffId} onChange={(event) => setReschedule({ ...reschedule, staffId: event.target.value })}>
                      {data.staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
                    </select>
                  </label>
                  <label>Starts<input required type="datetime-local" value={reschedule.startsAt} onChange={(event) => setReschedule({ ...reschedule, startsAt: event.target.value })} /></label>
                  <label>Ends<input required type="datetime-local" value={reschedule.endsAt} onChange={(event) => setReschedule({ ...reschedule, endsAt: event.target.value })} /></label>
                </div>
                <div className="actions">
                  <button className="primary" type="submit">Save new time</button>
                  <button type="button" onClick={() => setReschedule(null)}>Close</button>
                </div>
              </form>
            )}
          </>
        )}
        {activePage === 'add-patient' && renderPatientForm()}
        {activePage === 'booking' && renderBookingForm()}
        {activePage === 'records' && renderPatientRecords()}
      </main>
    </div>
  );
}
