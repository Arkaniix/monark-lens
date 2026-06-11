import { E as EXTENSION_VERSION, M as MONARK_WEB_URL } from '../chunks/constants-DrhZHtLE.js';

true              &&(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
}());

var n,l$1,u$2,i$1,r$1,o$1,e$1,f$2,c$1,s$1,a$1,p$1={},v$1=[],y$1=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,d$1=Array.isArray;function w$1(n,l){for(var u in l)n[u]=l[u];return n}function g(n){n&&n.parentNode&&n.parentNode.removeChild(n);}function _(l,u,t){var i,r,o,e={};for(o in u)"key"==o?i=u[o]:"ref"==o?r=u[o]:e[o]=u[o];if(arguments.length>2&&(e.children=arguments.length>3?n.call(arguments,2):t),"function"==typeof l&&null!=l.defaultProps)for(o in l.defaultProps) void 0===e[o]&&(e[o]=l.defaultProps[o]);return m$1(l,e,i,r,null)}function m$1(n,t,i,r,o){var e={type:n,props:t,key:i,ref:r,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:null==o?++u$2:o,__i:-1,__u:0};return null==o&&null!=l$1.vnode&&l$1.vnode(e),e}function k$1(n){return n.children}function x(n,l){this.props=n,this.context=l;}function S(n,l){if(null==l)return n.__?S(n.__,n.__i+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return "function"==typeof n.type?S(n):null}function C$1(n){if(n.__P&&n.__d){var u=n.__v,t=u.__e,i=[],r=[],o=w$1({},u);o.__v=u.__v+1,l$1.vnode&&l$1.vnode(o),z$1(n.__P,o,u,n.__n,n.__P.namespaceURI,32&u.__u?[t]:null,i,null==t?S(u):t,!!(32&u.__u),r),o.__v=u.__v,o.__.__k[o.__i]=o,V(i,o,r),u.__e=u.__=null,o.__e!=t&&M(o);}}function M(n){if(null!=(n=n.__)&&null!=n.__c)return n.__e=n.__c.base=null,n.__k.some(function(l){if(null!=l&&null!=l.__e)return n.__e=n.__c.base=l.__e}),M(n)}function $(n){(!n.__d&&(n.__d=true)&&i$1.push(n)&&!I.__r++||r$1!=l$1.debounceRendering)&&((r$1=l$1.debounceRendering)||o$1)(I);}function I(){for(var n,l=1;i$1.length;)i$1.length>l&&i$1.sort(e$1),n=i$1.shift(),l=i$1.length,C$1(n);I.__r=0;}function P(n,l,u,t,i,r,o,e,f,c,s){var a,h,y,d,w,g,_,m=t&&t.__k||v$1,b=l.length;for(f=A(u,l,m,f,b),a=0;a<b;a++)null!=(y=u.__k[a])&&(h=-1!=y.__i&&m[y.__i]||p$1,y.__i=a,g=z$1(n,y,h,i,r,o,e,f,c,s),d=y.__e,y.ref&&h.ref!=y.ref&&(h.ref&&D$1(h.ref,null,y),s.push(y.ref,y.__c||d,y)),null==w&&null!=d&&(w=d),(_=!!(4&y.__u))||h.__k===y.__k?f=H(y,f,n,_):"function"==typeof y.type&&void 0!==g?f=g:d&&(f=d.nextSibling),y.__u&=-7);return u.__e=w,f}function A(n,l,u,t,i){var r,o,e,f,c,s=u.length,a=s,h=0;for(n.__k=new Array(i),r=0;r<i;r++)null!=(o=l[r])&&"boolean"!=typeof o&&"function"!=typeof o?("string"==typeof o||"number"==typeof o||"bigint"==typeof o||o.constructor==String?o=n.__k[r]=m$1(null,o,null,null,null):d$1(o)?o=n.__k[r]=m$1(k$1,{children:o},null,null,null):void 0===o.constructor&&o.__b>0?o=n.__k[r]=m$1(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):n.__k[r]=o,f=r+h,o.__=n,o.__b=n.__b+1,e=null,-1!=(c=o.__i=T(o,u,f,a))&&(a--,(e=u[c])&&(e.__u|=2)),null==e||null==e.__v?(-1==c&&(i>s?h--:i<s&&h++),"function"!=typeof o.type&&(o.__u|=4)):c!=f&&(c==f-1?h--:c==f+1?h++:(c>f?h--:h++,o.__u|=4))):n.__k[r]=null;if(a)for(r=0;r<s;r++)null!=(e=u[r])&&0==(2&e.__u)&&(e.__e==t&&(t=S(e)),E(e,e));return t}function H(n,l,u,t){var i,r;if("function"==typeof n.type){for(i=n.__k,r=0;i&&r<i.length;r++)i[r]&&(i[r].__=n,l=H(i[r],l,u,t));return l}n.__e!=l&&(t&&(l&&n.type&&!l.parentNode&&(l=S(n)),u.insertBefore(n.__e,l||null)),l=n.__e);do{l=l&&l.nextSibling;}while(null!=l&&8==l.nodeType);return l}function T(n,l,u,t){var i,r,o,e=n.key,f=n.type,c=l[u],s=null!=c&&0==(2&c.__u);if(null===c&&null==e||s&&e==c.key&&f==c.type)return u;if(t>(s?1:0))for(i=u-1,r=u+1;i>=0||r<l.length;)if(null!=(c=l[o=i>=0?i--:r++])&&0==(2&c.__u)&&e==c.key&&f==c.type)return o;return  -1}function j$1(n,l,u){"-"==l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||y$1.test(l)?u:u+"px";}function F(n,l,u,t,i){var r,o;n:if("style"==l)if("string"==typeof u)n.style.cssText=u;else {if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||j$1(n.style,l,"");if(u)for(l in u)t&&u[l]==t[l]||j$1(n.style,l,u[l]);}else if("o"==l[0]&&"n"==l[1])r=l!=(l=l.replace(f$2,"$1")),o=l.toLowerCase(),l=o in n||"onFocusOut"==l||"onFocusIn"==l?o.slice(2):l.slice(2),n.l||(n.l={}),n.l[l+r]=u,u?t?u.u=t.u:(u.u=c$1,n.addEventListener(l,r?a$1:s$1,r)):n.removeEventListener(l,r?a$1:s$1,r);else {if("http://www.w3.org/2000/svg"==i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&"popover"!=l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||false===u&&"-"!=l[4]?n.removeAttribute(l):n.setAttribute(l,"popover"==l&&1==u?"":u));}}function O(n){return function(u){if(this.l){var t=this.l[u.type+n];if(null==u.t)u.t=c$1++;else if(u.t<t.u)return;return t(l$1.event?l$1.event(u):u)}}}function z$1(n,u,t,i,r,o,e,f,c,s){var a,h,p,y,_,m,b,S,C,M,$,I,A,H,L,T=u.type;if(void 0!==u.constructor)return null;128&t.__u&&(c=!!(32&t.__u),o=[f=u.__e=t.__e]),(a=l$1.__b)&&a(u);n:if("function"==typeof T)try{if(S=u.props,C="prototype"in T&&T.prototype.render,M=(a=T.contextType)&&i[a.__c],$=a?M?M.props.value:a.__:i,t.__c?b=(h=u.__c=t.__c).__=h.__E:(C?u.__c=h=new T(S,$):(u.__c=h=new x(S,$),h.constructor=T,h.render=G),M&&M.sub(h),h.state||(h.state={}),h.__n=i,p=h.__d=!0,h.__h=[],h._sb=[]),C&&null==h.__s&&(h.__s=h.state),C&&null!=T.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=w$1({},h.__s)),w$1(h.__s,T.getDerivedStateFromProps(S,h.__s))),y=h.props,_=h.state,h.__v=u,p)C&&null==T.getDerivedStateFromProps&&null!=h.componentWillMount&&h.componentWillMount(),C&&null!=h.componentDidMount&&h.__h.push(h.componentDidMount);else {if(C&&null==T.getDerivedStateFromProps&&S!==y&&null!=h.componentWillReceiveProps&&h.componentWillReceiveProps(S,$),u.__v==t.__v||!h.__e&&null!=h.shouldComponentUpdate&&!1===h.shouldComponentUpdate(S,h.__s,$)){u.__v!=t.__v&&(h.props=S,h.state=h.__s,h.__d=!1),u.__e=t.__e,u.__k=t.__k,u.__k.some(function(n){n&&(n.__=u);}),v$1.push.apply(h.__h,h._sb),h._sb=[],h.__h.length&&e.push(h);break n}null!=h.componentWillUpdate&&h.componentWillUpdate(S,h.__s,$),C&&null!=h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(y,_,m);});}if(h.context=$,h.props=S,h.__P=n,h.__e=!1,I=l$1.__r,A=0,C)h.state=h.__s,h.__d=!1,I&&I(u),a=h.render(h.props,h.state,h.context),v$1.push.apply(h.__h,h._sb),h._sb=[];else do{h.__d=!1,I&&I(u),a=h.render(h.props,h.state,h.context),h.state=h.__s;}while(h.__d&&++A<25);h.state=h.__s,null!=h.getChildContext&&(i=w$1(w$1({},i),h.getChildContext())),C&&!p&&null!=h.getSnapshotBeforeUpdate&&(m=h.getSnapshotBeforeUpdate(y,_)),H=null!=a&&a.type===k$1&&null==a.key?q(a.props.children):a,f=P(n,d$1(H)?H:[H],u,t,i,r,o,e,f,c,s),h.base=u.__e,u.__u&=-161,h.__h.length&&e.push(h),b&&(h.__E=h.__=null);}catch(n){if(u.__v=null,c||null!=o)if(n.then){for(u.__u|=c?160:128;f&&8==f.nodeType&&f.nextSibling;)f=f.nextSibling;o[o.indexOf(f)]=null,u.__e=f;}else {for(L=o.length;L--;)g(o[L]);N(u);}else u.__e=t.__e,u.__k=t.__k,n.then||N(u);l$1.__e(n,u,t);}else null==o&&u.__v==t.__v?(u.__k=t.__k,u.__e=t.__e):f=u.__e=B$1(t.__e,u,t,i,r,o,e,c,s);return (a=l$1.diffed)&&a(u),128&u.__u?void 0:f}function N(n){n&&(n.__c&&(n.__c.__e=true),n.__k&&n.__k.some(N));}function V(n,u,t){for(var i=0;i<t.length;i++)D$1(t[i],t[++i],t[++i]);l$1.__c&&l$1.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u);});}catch(n){l$1.__e(n,u.__v);}});}function q(n){return "object"!=typeof n||null==n||n.__b>0?n:d$1(n)?n.map(q):w$1({},n)}function B$1(u,t,i,r,o,e,f,c,s){var a,h,v,y,w,_,m,b=i.props||p$1,k=t.props,x=t.type;if("svg"==x?o="http://www.w3.org/2000/svg":"math"==x?o="http://www.w3.org/1998/Math/MathML":o||(o="http://www.w3.org/1999/xhtml"),null!=e)for(a=0;a<e.length;a++)if((w=e[a])&&"setAttribute"in w==!!x&&(x?w.localName==x:3==w.nodeType)){u=w,e[a]=null;break}if(null==u){if(null==x)return document.createTextNode(k);u=document.createElementNS(o,x,k.is&&k),c&&(l$1.__m&&l$1.__m(t,e),c=false),e=null;}if(null==x)b===k||c&&u.data==k||(u.data=k);else {if(e=e&&n.call(u.childNodes),!c&&null!=e)for(b={},a=0;a<u.attributes.length;a++)b[(w=u.attributes[a]).name]=w.value;for(a in b)w=b[a],"dangerouslySetInnerHTML"==a?v=w:"children"==a||a in k||"value"==a&&"defaultValue"in k||"checked"==a&&"defaultChecked"in k||F(u,a,null,w,o);for(a in k)w=k[a],"children"==a?y=w:"dangerouslySetInnerHTML"==a?h=w:"value"==a?_=w:"checked"==a?m=w:c&&"function"!=typeof w||b[a]===w||F(u,a,w,b[a],o);if(h)c||v&&(h.__html==v.__html||h.__html==u.innerHTML)||(u.innerHTML=h.__html),t.__k=[];else if(v&&(u.innerHTML=""),P("template"==t.type?u.content:u,d$1(y)?y:[y],t,i,r,"foreignObject"==x?"http://www.w3.org/1999/xhtml":o,e,f,e?e[0]:i.__k&&S(i,0),c,s),null!=e)for(a=e.length;a--;)g(e[a]);c||(a="value","progress"==x&&null==_?u.removeAttribute("value"):null!=_&&(_!==u[a]||"progress"==x&&!_||"option"==x&&_!=b[a])&&F(u,a,_,b[a],o),a="checked",null!=m&&m!=u[a]&&F(u,a,m,b[a],o));}return u}function D$1(n,u,t){try{if("function"==typeof n){var i="function"==typeof n.__u;i&&n.__u(),i&&null==u||(n.__u=n(u));}else n.current=u;}catch(n){l$1.__e(n,t);}}function E(n,u,t){var i,r;if(l$1.unmount&&l$1.unmount(n),(i=n.ref)&&(i.current&&i.current!=n.__e||D$1(i,null,u)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount();}catch(n){l$1.__e(n,u);}i.base=i.__P=null;}if(i=n.__k)for(r=0;r<i.length;r++)i[r]&&E(i[r],u,t||"function"!=typeof n.type);t||g(n.__e),n.__c=n.__=n.__e=void 0;}function G(n,l,u){return this.constructor(n,u)}function J(u,t,i){var r,o,e,f;t==document&&(t=document.documentElement),l$1.__&&l$1.__(u,t),o=(r="function"=="undefined")?null:t.__k,e=[],f=[],z$1(t,u=(t).__k=_(k$1,null,[u]),o||p$1,p$1,t.namespaceURI,o?null:t.firstChild?n.call(t.childNodes):null,e,o?o.__e:t.firstChild,r,f),V(e,u,f);}n=v$1.slice,l$1={__e:function(n,l,u,t){for(var i,r,o;l=l.__;)if((i=l.__c)&&!i.__)try{if((r=i.constructor)&&null!=r.getDerivedStateFromError&&(i.setState(r.getDerivedStateFromError(n)),o=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),o=i.__d),o)return i.__E=i}catch(l){n=l;}throw n}},u$2=0,x.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!=this.state?this.__s:this.__s=w$1({},this.state),"function"==typeof n&&(n=n(w$1({},u),this.props)),n&&w$1(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),$(this));},x.prototype.forceUpdate=function(n){this.__v&&(this.__e=true,n&&this.__h.push(n),$(this));},x.prototype.render=k$1,i$1=[],o$1="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,e$1=function(n,l){return n.__v.__b-l.__v.__b},I.__r=0,f$2=/(PointerCapture)$|Capture$/i,c$1=0,s$1=O(false),a$1=O(true);

var f$1=0;function u$1(e,t,n,o,i,u){t||(t={});var a,c,p=t;if("ref"in p)for(c in p={},t)"ref"==c?a=t[c]:p[c]=t[c];var l={type:e,props:p,key:n,ref:a,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:--f$1,__i:-1,__u:0,__source:i,__self:u};if("function"==typeof e&&(a=e.defaultProps))for(c in a) void 0===p[c]&&(p[c]=a[c]);return l$1.vnode&&l$1.vnode(l),l}

var t,r,u,i,o=0,f=[],c=l$1,e=c.__b,a=c.__r,v=c.diffed,l=c.__c,m=c.unmount,s=c.__;function p(n,t){c.__h&&c.__h(r,n,o||t),o=0;var u=r.__H||(r.__H={__:[],__h:[]});return n>=u.__.length&&u.__.push({}),u.__[n]}function d(n){return o=1,h(D,n)}function h(n,u,i){var o=p(t++,2);if(o.t=n,!o.__c&&(o.__=[D(void 0,u),function(n){var t=o.__N?o.__N[0]:o.__[0],r=o.t(t,n);t!==r&&(o.__N=[r,o.__[1]],o.__c.setState({}));}],o.__c=r,!r.__f)){var f=function(n,t,r){if(!o.__c.__H)return  true;var u=o.__c.__H.__.filter(function(n){return n.__c});if(u.every(function(n){return !n.__N}))return !c||c.call(this,n,t,r);var i=o.__c.props!==n;return u.some(function(n){if(n.__N){var t=n.__[0];n.__=n.__N,n.__N=void 0,t!==n.__[0]&&(i=true);}}),c&&c.call(this,n,t,r)||i};r.__f=true;var c=r.shouldComponentUpdate,e=r.componentWillUpdate;r.componentWillUpdate=function(n,t,r){if(this.__e){var u=c;c=void 0,f(n,t,r),c=u;}e&&e.call(this,n,t,r);},r.shouldComponentUpdate=f;}return o.__N||o.__}function y(n,u){var i=p(t++,3);!c.__s&&C(i.__H,u)&&(i.__=n,i.u=u,r.__H.__h.push(i));}function j(){for(var n;n=f.shift();){var t=n.__H;if(n.__P&&t)try{t.__h.some(z),t.__h.some(B),t.__h=[];}catch(r){t.__h=[],c.__e(r,n.__v);}}}c.__b=function(n){r=null,e&&e(n);},c.__=function(n,t){n&&t.__k&&t.__k.__m&&(n.__m=t.__k.__m),s&&s(n,t);},c.__r=function(n){a&&a(n),t=0;var i=(r=n.__c).__H;i&&(u===r?(i.__h=[],r.__h=[],i.__.some(function(n){n.__N&&(n.__=n.__N),n.u=n.__N=void 0;})):(i.__h.some(z),i.__h.some(B),i.__h=[],t=0)),u=r;},c.diffed=function(n){v&&v(n);var t=n.__c;t&&t.__H&&(t.__H.__h.length&&(1!==f.push(t)&&i===c.requestAnimationFrame||((i=c.requestAnimationFrame)||w)(j)),t.__H.__.some(function(n){n.u&&(n.__H=n.u),n.u=void 0;})),u=r=null;},c.__c=function(n,t){t.some(function(n){try{n.__h.some(z),n.__h=n.__h.filter(function(n){return !n.__||B(n)});}catch(r){t.some(function(n){n.__h&&(n.__h=[]);}),t=[],c.__e(r,n.__v);}}),l&&l(n,t);},c.unmount=function(n){m&&m(n);var t,r=n.__c;r&&r.__H&&(r.__H.__.some(function(n){try{z(n);}catch(n){t=n;}}),r.__H=void 0,t&&c.__e(t,r.__v));};var k="function"==typeof requestAnimationFrame;function w(n){var t,r=function(){clearTimeout(u),k&&cancelAnimationFrame(t),setTimeout(n);},u=setTimeout(r,35);k&&(t=requestAnimationFrame(r));}function z(n){var t=r,u=n.__c;"function"==typeof u&&(n.__c=void 0,u()),r=t;}function B(n){var t=r;n.__c=n.__(),r=t;}function C(n,t){return !n||n.length!==t.length||t.some(function(t,r){return t!==n[r]})}function D(n,t){return "function"==typeof t?t(n):t}

function App() {
  const [authState, setAuthState] = d(null);
  const [loading, setLoading] = d(true);
  y(() => {
    loadAuthState();
  }, []);
  async function loadAuthState() {
    try {
      const state = await chrome.runtime.sendMessage({
        type: "GET_AUTH_STATE"
      });
      setAuthState(state);
    } catch {
      setAuthState({
        isLoggedIn: false,
        email: null,
        plan: "free",
        credits: 0,
        unlimited: false,
        sessionSignals: 0,
        sessionCredits: 0
      });
    }
    setLoading(false);
  }
  if (loading) {
    return /* @__PURE__ */ u$1("div", { children: [
      /* @__PURE__ */ u$1(Header, {}),
      /* @__PURE__ */ u$1("div", { style: { padding: "40px", textAlign: "center" }, children: /* @__PURE__ */ u$1("div", { class: "spinner" }) })
    ] });
  }
  return /* @__PURE__ */ u$1("div", { children: [
    /* @__PURE__ */ u$1(Header, {}),
    authState?.isLoggedIn ? /* @__PURE__ */ u$1(Dashboard, { authState, onLogout: loadAuthState }) : /* @__PURE__ */ u$1(LoginForm, { onLogin: loadAuthState }),
    /* @__PURE__ */ u$1(Footer, {})
  ] });
}
function Header() {
  return /* @__PURE__ */ u$1("div", { class: "popup-header", children: /* @__PURE__ */ u$1("div", { class: "popup-brand", children: [
    /* @__PURE__ */ u$1("div", { class: "popup-brand-logo", children: "🔍" }),
    /* @__PURE__ */ u$1("div", { children: [
      /* @__PURE__ */ u$1("div", { class: "popup-brand-name", children: "Monark Lens" }),
      /* @__PURE__ */ u$1("div", { class: "popup-brand-version", children: [
        "v",
        EXTENSION_VERSION
      ] })
    ] })
  ] }) });
}
function LoginForm({ onLogin }) {
  const [email, setEmail] = d("");
  const [password, setPassword] = d("");
  const [error, setError] = d("");
  const [submitting, setSubmitting] = d(false);
  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await chrome.runtime.sendMessage({
        type: "LOGIN",
        email,
        password
      });
      if (result?.error) {
        setError(result.error);
      } else {
        onLogin();
      }
    } catch (err) {
      setError(err.message || "Erreur de connexion");
    }
    setSubmitting(false);
  }
  return /* @__PURE__ */ u$1("div", { class: "login-container", children: [
    /* @__PURE__ */ u$1("div", { class: "login-title", children: "Connexion" }),
    /* @__PURE__ */ u$1("div", { class: "login-subtitle", children: "Connectez-vous pour accéder aux analyses complètes et gagner des crédits" }),
    /* @__PURE__ */ u$1("div", { class: "form-group", children: [
      /* @__PURE__ */ u$1("label", { class: "form-label", children: "Email" }),
      /* @__PURE__ */ u$1(
        "input",
        {
          class: "form-input",
          type: "email",
          placeholder: "votre@email.com",
          value: email,
          onInput: (e) => setEmail(e.target.value),
          disabled: submitting
        }
      )
    ] }),
    /* @__PURE__ */ u$1("div", { class: "form-group", children: [
      /* @__PURE__ */ u$1("label", { class: "form-label", children: "Mot de passe" }),
      /* @__PURE__ */ u$1(
        "input",
        {
          class: "form-input",
          type: "password",
          placeholder: "••••••••",
          value: password,
          onInput: (e) => setPassword(e.target.value),
          disabled: submitting,
          onKeyDown: (e) => e.key === "Enter" && handleSubmit(e)
        }
      )
    ] }),
    /* @__PURE__ */ u$1(
      "button",
      {
        class: "btn-primary",
        onClick: handleSubmit,
        disabled: submitting || !email || !password,
        children: submitting ? "Connexion..." : "Se connecter"
      }
    ),
    error && /* @__PURE__ */ u$1("div", { class: "login-error", children: error }),
    /* @__PURE__ */ u$1("div", { class: "login-footer", children: [
      "Pas encore de compte ?",
      " ",
      /* @__PURE__ */ u$1("a", { href: `${MONARK_WEB_URL}/signup`, target: "_blank", children: "Créer un compte" })
    ] })
  ] });
}
function Dashboard({
  authState,
  onLogout
}) {
  const [detection, setDetection] = d({ platform: null, componentId: null, componentName: null, price: null });
  const [missions, setMissions] = d([]);
  y(() => {
    loadDetection();
    loadMissions();
  }, []);
  async function loadDetection() {
    const stored = await chrome.storage.local.get([
      "current_platform",
      "current_component_id",
      "current_component_name",
      "current_price"
    ]);
    setDetection({
      platform: stored.current_platform || null,
      componentId: stored.current_component_id || null,
      componentName: stored.current_component_name || null,
      price: stored.current_price || null
    });
  }
  async function loadMissions() {
    try {
      const result = await chrome.runtime.sendMessage({ type: "GET_MISSIONS" });
      if (result?.missions) {
        setMissions(result.missions);
      }
    } catch {
    }
  }
  async function handleLogout() {
    await chrome.runtime.sendMessage({ type: "LOGOUT" });
    onLogout();
  }
  async function handleQuickAnalysis() {
    if (!detection.componentId || !detection.price) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        action: "TRIGGER_QUICK",
        componentId: detection.componentId,
        price: detection.price
      });
      window.close();
    }
  }
  const planLabels = {
    free: "Gratuit",
    basic: "Standard",
    standard: "Standard",
    starter: "Standard",
    pro: "Pro",
    elite: "Élite",
    admin: "Admin"
  };
  return /* @__PURE__ */ u$1("div", { class: "dashboard", children: [
    /* @__PURE__ */ u$1("div", { class: "user-bar", children: [
      /* @__PURE__ */ u$1("div", { children: [
        /* @__PURE__ */ u$1("div", { class: "user-email", children: authState.email }),
        /* @__PURE__ */ u$1("span", { class: "user-plan", children: planLabels[authState.plan] || authState.plan })
      ] }),
      /* @__PURE__ */ u$1("button", { class: "btn-logout", onClick: handleLogout, children: "Déconnexion" })
    ] }),
    /* @__PURE__ */ u$1("div", { class: "stats-grid", children: [
      /* @__PURE__ */ u$1("div", { class: "stat-card", children: [
        /* @__PURE__ */ u$1("div", { class: "stat-value credits", children: authState.unlimited ? "∞" : authState.credits }),
        /* @__PURE__ */ u$1("div", { class: "stat-label", children: "Crédits" })
      ] }),
      /* @__PURE__ */ u$1("div", { class: "stat-card", children: [
        /* @__PURE__ */ u$1("div", { class: "stat-value signals", children: authState.sessionSignals }),
        /* @__PURE__ */ u$1("div", { class: "stat-label", children: "Signaux envoyés" })
      ] })
    ] }),
    /* @__PURE__ */ u$1("div", { class: "detection-status", children: [
      /* @__PURE__ */ u$1("div", { class: "detection-header", children: "Détection en cours" }),
      /* @__PURE__ */ u$1("div", { class: "detection-row", style: { marginBottom: "4px" }, children: [
        /* @__PURE__ */ u$1("span", { class: "detection-label", children: "Plateforme" }),
        detection.platform ? /* @__PURE__ */ u$1("span", { class: "detection-badge active", children: [
          "● ",
          detection.platform
        ] }) : /* @__PURE__ */ u$1("span", { class: "detection-badge inactive", children: "● Non détectée" })
      ] }),
      detection.componentName && /* @__PURE__ */ u$1("div", { class: "detection-row", style: { marginBottom: "4px" }, children: [
        /* @__PURE__ */ u$1("span", { class: "detection-label", children: "Composant" }),
        /* @__PURE__ */ u$1("span", { class: "detection-value", children: detection.componentName })
      ] }),
      detection.price && /* @__PURE__ */ u$1("div", { class: "detection-row", children: [
        /* @__PURE__ */ u$1("span", { class: "detection-label", children: "Prix" }),
        /* @__PURE__ */ u$1("span", { class: "detection-value", children: [
          detection.price.toFixed(0),
          "€"
        ] })
      ] })
    ] }),
    detection.componentId && detection.price && /* @__PURE__ */ u$1(
      "button",
      {
        class: "btn-quick",
        onClick: handleQuickAnalysis,
        disabled: !authState.unlimited && authState.credits < 5,
        children: authState.unlimited || authState.credits >= 5 ? `🔬 Analyse complète (5 crédits)` : `Crédits insuffisants (${authState.credits}/5)`
      }
    ),
    missions.length > 0 && /* @__PURE__ */ u$1("div", { class: "missions-section", children: [
      /* @__PURE__ */ u$1("div", { class: "missions-header", children: "Missions actives" }),
      missions.map((m) => /* @__PURE__ */ u$1("div", { class: "mission-card", children: [
        /* @__PURE__ */ u$1("div", { class: "mission-title", children: [
          m.completed ? "✅" : "🎯",
          " ",
          m.title
        ] }),
        /* @__PURE__ */ u$1("div", { class: "mission-progress-bar", children: /* @__PURE__ */ u$1(
          "div",
          {
            class: `mission-progress-fill ${m.completed ? "complete" : ""}`,
            style: {
              width: `${Math.min(100, m.current_count / m.target_count * 100)}%`
            }
          }
        ) }),
        /* @__PURE__ */ u$1("div", { class: "mission-footer", children: [
          /* @__PURE__ */ u$1("span", { children: [
            m.current_count,
            "/",
            m.target_count
          ] }),
          /* @__PURE__ */ u$1("span", { class: "mission-reward", children: [
            "+",
            m.reward_credits,
            " crédits"
          ] })
        ] })
      ] }, m.id))
    ] }),
    /* @__PURE__ */ u$1(Settings, {})
  ] });
}
function Settings() {
  const [autoSignal, setAutoSignal] = d(true);
  const [overlayEnabled, setOverlayEnabled] = d(true);
  y(() => {
    chrome.storage.local.get(["auto_signal", "overlay_enabled"]).then((data) => {
      setAutoSignal(data.auto_signal !== false);
      setOverlayEnabled(data.overlay_enabled !== false);
    });
  }, []);
  function toggleAutoSignal() {
    const newVal = !autoSignal;
    setAutoSignal(newVal);
    chrome.storage.local.set({ auto_signal: newVal });
  }
  function toggleOverlay() {
    const newVal = !overlayEnabled;
    setOverlayEnabled(newVal);
    chrome.storage.local.set({ overlay_enabled: newVal });
  }
  return /* @__PURE__ */ u$1("div", { class: "settings-section", children: [
    /* @__PURE__ */ u$1("div", { class: "settings-header", children: "⚙️ Paramètres" }),
    /* @__PURE__ */ u$1("label", { class: "setting-row", children: [
      /* @__PURE__ */ u$1("div", { children: [
        /* @__PURE__ */ u$1("div", { class: "setting-name", children: "Collecte passive" }),
        /* @__PURE__ */ u$1("div", { class: "setting-desc", children: "Envoyer des signaux de prix en naviguant" })
      ] }),
      /* @__PURE__ */ u$1("input", { type: "checkbox", checked: autoSignal, onChange: toggleAutoSignal })
    ] }),
    /* @__PURE__ */ u$1("label", { class: "setting-row", children: [
      /* @__PURE__ */ u$1("div", { children: [
        /* @__PURE__ */ u$1("div", { class: "setting-name", children: "Overlay d'analyse" }),
        /* @__PURE__ */ u$1("div", { class: "setting-desc", children: "Afficher le score sur les annonces" })
      ] }),
      /* @__PURE__ */ u$1("input", { type: "checkbox", checked: overlayEnabled, onChange: toggleOverlay })
    ] })
  ] });
}
function Footer() {
  return /* @__PURE__ */ u$1("div", { class: "popup-footer", children: /* @__PURE__ */ u$1("a", { href: MONARK_WEB_URL, target: "_blank", children: "Ouvrir Monark Market →" }) });
}
J(/* @__PURE__ */ u$1(App, {}), document.getElementById("app"));
