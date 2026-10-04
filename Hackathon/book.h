#pragma once
#include<string>
enum class borrowstatus
{
    available,
    borrowed
};
class book
{
    private:
        std::string id;
        std::string title;
        std::string auther;
        borrowstatus status;
    public:
        book(const std::string& newtitle,const std::string& newid,const std::string& newauther);
        const std::string& getid() const;
        const std::string& gettitle() const;
        const std::string& getauther() const;
        borrowstatus getstatus() const; 
        void showinfo() const;
        bool borrow();
        bool returnbook();
};