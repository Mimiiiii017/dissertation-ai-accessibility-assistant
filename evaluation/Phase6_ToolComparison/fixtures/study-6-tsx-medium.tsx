import React, { useState, useRef, useEffect, useCallback } from 'react';

const CustomButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({
  onClick,
  children,
}) => {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', padding: '8px' }}>
      {children}
    </div>
  );
};

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

const Navigation: React.FC<{ items: NavItem[] }> = ({ items }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav>
      <button onClick={() => setIsOpen(!isOpen)}>
        Menu
      </button>
      {isOpen && (
        <ul>
          {items.map((item, index) => (
            <li key={index}>
              <a href={item.href}>
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
};

interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

const Tabs: React.FC<{ tabs: TabItem[] }> = ({ tabs }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      <div role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={index === activeTab}
            onClick={() => setActiveTab(index)}
            tabIndex={index === activeTab ? 0 : -1}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          style={{ display: index === activeTab ? 'block' : 'none' }}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea';
  required?: boolean;
}

const Form: React.FC<{ fields: FormField[]; onSubmit: (data: any) => void }> = ({
  fields,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    fields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = 'This field is required';
      }
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {fields.map(field => (
        <div key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          {field.type === 'textarea' ? (
            <textarea
              id={field.name}
              name={field.name}
              value={formData[field.name] || ''}
              onChange={handleChange}
            />
          ) : (
            <input
              id={field.name}
              type={field.type}
              name={field.name}
              value={formData[field.name] || ''}
              onChange={handleChange}
              required={field.required}
            />
          )}
          {errors[field.name] && (
            <span style={{ color: 'red' }}>
              {errors[field.name]}
            </span>
          )}
        </div>
      ))}
      <button type="submit">Submit</button>
    </form>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div ref={modalRef} role="dialog" aria-labelledby="modal-title">
        <h2 id="modal-title">{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

interface DropdownOption {
  value: string;
  label: string;
}

const Dropdown: React.FC<{
  options: DropdownOption[];
  onChange: (value: string) => void;
  label?: string;
}> = ({ options, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(options[0]?.value);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (value: string) => {
    setSelectedValue(value);
    onChange(value);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef}>
      {label && <label>{label}</label>}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
      >
        {options.find(opt => opt.value === selectedValue)?.label || 'Select'}
      </button>
      {isOpen && (
        <ul role="listbox">
          {options.map(option => (
            <li
              key={option.value}
              role="option"
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface ListItem {
  id: string;
  title: string;
  description?: string;
}

const List: React.FC<{ items: ListItem[] }> = ({ items }) => {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>
          <div>{item.title}</div>
          <div>{item.description}</div>
        </li>
      ))}
    </ul>
  );
};

const LoadingSpinner: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div
      style={{
        animation: 'spin 1s linear infinite',
        width: '24px',
        height: '24px',
        border: '2px solid #f3f3f3',
        borderTop: '2px solid #3498db',
        borderRadius: '50%',
      }}
    />
  );
};

interface AlertProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onDismiss?: () => void;
}

const Alert: React.FC<AlertProps> = ({ message, type, onDismiss }) => {
  return (
    <div
      role="alert"
      style={{
        padding: '12px',
        color: type === 'error' ? 'red' : 'blue',
        background: type === 'error' ? '#ffe0e0' : '#e0e0ff',
      }}
    >
      {message}
      {onDismiss && (
        <button onClick={onDismiss}>Dismiss</button>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [cartItems, setCartItems] = useState<ListItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const navItems: NavItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  const tabs: TabItem[] = [
    { id: 'tab-1', label: 'Overview', content: <div>Overview content</div> },
    { id: 'tab-2', label: 'Details', content: <div>Details content</div> },
    { id: 'tab-3', label: 'Reviews', content: <div>Reviews content</div> },
  ];

  const formFields: FormField[] = [
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'name', label: 'Full Name', type: 'text', required: true },
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'message', label: 'Message', type: 'textarea' },
  ];

  const dropdownOptions: DropdownOption[] = [
    { value: 'all', label: 'All Products' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'books', label: 'Books' },
  ];

  const listItems: ListItem[] = Array.from({ length: 10 }, (_, i) => ({
    id: `item-${i}`,
    title: `Product ${i + 1}`,
    description: `Description for product ${i + 1}`,
  }));

  return (
    <div style={{ padding: '20px' }}>
      <header>
        <h1>Study 6 App</h1>
        <Navigation items={navItems} />
      </header>

      <main>
        <section>
          <h2>Welcome</h2>
          <Tabs tabs={tabs} />
        </section>

        <section>
          <h2>Contact Us</h2>
          <Form
            fields={formFields}
            onSubmit={data => console.log('Form submitted:', data)}
          />
        </section>

        <section>
          <h2>Filter Products</h2>
          <Dropdown
            label="Category"
            options={dropdownOptions}
            onChange={value => console.log('Selected:', value)}
          />
        </section>

        <section>
          <h2>Products</h2>
          <List items={listItems} />
          <button onClick={() => setShowCart(!showCart)}>
            View Cart ({cartItems.length})
          </button>
        </section>

        <Modal
          isOpen={showCart}
          onClose={() => setShowCart(false)}
          title="Shopping Cart"
        >
          <List items={cartItems.length > 0 ? cartItems : [{ id: 'empty', title: 'Cart is empty' }]} />
        </Modal>

        <Alert message="Welcome to our store!" type="info" />
      </main>

      <LoadingSpinner isLoading={false} />
    </div>
  );
};

export default App;

export const useAsync = <T,>(
  asyncFunction: () => Promise<T>,
  immediate = true,
) => {
  const [state, setState] = useState<{
    status: 'idle' | 'pending' | 'success' | 'error';
    data: T | null;
    error: Error | null;
  }>({ status: 'idle', data: null, error: null });

  const execute = useCallback(async () => {
    setState({ status: 'pending', data: null, error: null });
    try {
      const response = await asyncFunction();
      setState({ status: 'success', data: response, error: null });
      return response;
    } catch (error) {
      setState({ status: 'error', data: null, error: error as Error });
      throw error;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) execute();
  }, [execute, immediate]);

  return { ...state, execute };
};

export const useDebounce = <T,>(value: T, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
};

export const useTimeout = (callback: () => void, delay: number | null) => {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
};

type Primitive = string | number | boolean | null | undefined;
type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;
type Readonly<T> = { readonly [P in keyof T]: T[P] };

export { CustomButton, Navigation, Tabs, Form, Dropdown, Modal, List, LoadingSpinner, Alert };
