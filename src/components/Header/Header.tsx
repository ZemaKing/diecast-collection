import './Header.css';
import {Instagram} from '../../icons/Instagram.tsx';
import {Email} from '../../icons/Email.tsx';

type Props = {
    title: string;
    count: number;
    rightSlot?: React.ReactNode;
};

export function Header({ title, count, rightSlot }: Props) {
    return (
        <header className="topHeader">
            <div className="logo">{title}</div>

            <div className="headerRight">
                <div className="countPill countPillTotal">{count} models</div>
                {rightSlot}
              <div className="countPill countPillTotal">
                <a
                  className="linkPill"
                  href="https://www.instagram.com/zemaking89/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                ><Instagram/></a>
              </div>
              <div className="countPill countPillTotal">
                <a href="mailto:zematule@gmail.com" className="linkPill" aria-label="Email">
                  <Email/>
                </a>
              </div>
            </div>
        </header>
    );
}
