import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { WorkflowProvider } from './context/WorkflowContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WorkflowProvider>
      <App />
    </WorkflowProvider>
  </React.StrictMode>
)
